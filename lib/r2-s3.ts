import { createHash, createHmac } from "node:crypto";

/**
 * Minimal Cloudflare R2 (S3-compatible) client.
 *
 * WHY THIS EXISTS. The brief said to reuse the project's existing R2
 * infrastructure. There is none at runtime: `.env.r2` and
 * `scripts/upload-catalogue-derivatives.mjs` are a one-off migration script that
 * shells out to `wrangler r2 object put`, and `wrangler` is a devDependency.
 * Spawning it from a Vercel serverless function is not viable. There is also no
 * S3 SDK in package.json. So this is a small, dependency-free SigV4 signer
 * built on `node:crypto` — the same provider (Cloudflare R2) and the same
 * environment variable names that `.env.r2` already documents, so no second
 * storage vendor is introduced.
 *
 * It is deliberately NOT a general-purpose S3 client. It does exactly the two
 * things the banner manager needs: PUT an object and DELETE an object.
 *
 * SECURITY. The signing helpers are exported separately from the fetch calls so
 * they can be unit-tested against AWS's published SigV4 test vector, which is
 * what makes "this signs correctly" a checkable claim rather than an assumption.
 */

const SERVICE = "s3";
/** Exported so the known-answer test can assert the algorithm token verbatim. */
export const ALGORITHM = "AWS4-HMAC-SHA256";

export type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Full S3 endpoint, e.g. https://<account>.r2.cloudflarestorage.com */
  endpoint: string;
  region: string;
};

export class R2ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2ConfigurationError";
  }
}

/**
 * Read R2 credentials from the environment.
 *
 * Returns null — rather than throwing — when the bucket is not configured, so a
 * build or a preview deployment without secrets still renders the storefront
 * and the admin screen instead of failing. Callers that genuinely need the
 * bucket turn that null into a 503 with a clear message.
 */
export function readR2Config(): R2Config | null {
  const accessKeyId = trimmed(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = trimmed(process.env.R2_SECRET_ACCESS_KEY);
  const bucket = trimmed(process.env.R2_BUCKET_NAME);
  if (!accessKeyId || !secretAccessKey || !bucket) return null;

  const accountId = trimmed(process.env.CLOUDFLARE_ACCOUNT_ID);
  const endpoint =
    trimmed(process.env.R2_ENDPOINT) ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
  if (!endpoint) return null;

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: endpoint.replace(/\/+$/, ""),
    // R2 ignores the region but SigV4 requires one; "auto" is the documented
    // value for R2 and is accepted by its S3 endpoint.
    region: trimmed(process.env.R2_REGION) || "auto",
  };
}

/** Like readR2Config, but throws a message an admin can act on. */
export function requireR2Config(): R2Config {
  const config = readR2Config();
  if (!config) {
    throw new R2ConfigurationError(
      "Banner uploads are not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME (plus CLOUDFLARE_ACCOUNT_ID or R2_ENDPOINT) in the deployment environment.",
    );
  }
  return config;
}

function trimmed(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

/**
 * The SigV4 signing key: HMAC chained over date, region, service, terminator.
 * Exported for the known-answer test.
 */
export function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string = SERVICE,
): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

/**
 * RFC 3986 encoding, which differs from `encodeURIComponent` for `!*'()`.
 * S3 requires this exact function, so it is written out rather than delegated.
 */
export function uriEncode(value: string, encodeSlash = true): string {
  let out = "";
  for (const char of value) {
    if (/[A-Za-z0-9\-._~]/.test(char)) {
      out += char;
    } else if (char === "/") {
      out += encodeSlash ? "%2F" : "/";
    } else {
      for (const byte of Buffer.from(char, "utf8")) {
        out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
      }
    }
  }
  return out;
}

/**
 * The canonical path for a canonical request.
 *
 * S3 (and R2) use the path un-normalised and do NOT double-encode an already
 * encoded key, so each segment is encoded once and the slashes between
 * segments are preserved. Encoding the slashes would address a different
 * object.
 */
export function canonicalUri(path: string): string {
  if (!path || path === "/") return "/";
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  return withLeading
    .split("/")
    .map((segment) => uriEncode(segment))
    .join("/");
}

function canonicalQuery(query: Record<string, string> = {}): string {
  return Object.keys(query)
    .map((key) => [uriEncode(key), uriEncode(query[key])] as const)
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export type CanonicalRequestInput = {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  payloadHash: string;
  /** Override so the known-answer test can pin the clock. */
  timestamp?: Date;
};

/**
 * Sign a request and return the COMPLETE header set to send, including the
 * `Authorization` value.
 *
 * This exists so a caller cannot sign one thing and send another. The previous
 * shape returned only the `Authorization` string, which forced the caller to
 * supply `x-amz-date` itself - and because the signature embeds the timestamp
 * that was current when it was computed, a clock tick between signing and
 * sending produced a header that did not match the signature. R2 rejects those
 * with SignatureDoesNotMatch, intermittently, on an arbitrary fraction of
 * uploads. Producing the headers and the signature from one clock read makes
 * that failure mode unrepresentable.
 */
export function signedRequestHeaders(params: {
  config: Pick<R2Config, "accessKeyId" | "secretAccessKey" | "region">;
  method: string;
  path: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  payloadHash: string;
  timestamp?: Date;
}): {
  headers: Record<string, string>;
  authorization: string;
  amzDate: string;
} {
  const { config, method, path, query, headers, payloadHash, timestamp } = params;
  const now = timestamp ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const lower = new Map<string, string>();
  for (const [name, value] of Object.entries(headers)) {
    lower.set(name.toLowerCase().trim(), String(value).trim().replace(/\s+/g, " "));
  }
  lower.set("x-amz-date", amzDate);
  lower.set("x-amz-content-sha256", payloadHash);

  const sortedNames = [...lower.keys()].sort();
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${lower.get(name)}\n`)
    .join("");
  const signedHeaders = sortedNames.join(";");

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(path),
    canonicalQuery(query),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    deriveSigningKey(config.secretAccessKey, dateStamp, config.region),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    /* The caller MUST send exactly this set. An unsigned extra header is
       tolerated by S3/R2, but a CHANGED signed header is not. */
    headers: Object.fromEntries(lower),
    authorization: `${ALGORITHM} Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
  };
}

/**
 * Just the `Authorization` value. A thin wrapper over signedRequestHeaders,
 * kept because the known-answer test asserts on the string form.
 */
export function buildAuthorization(params: {
  config: Pick<R2Config, "accessKeyId" | "secretAccessKey" | "region">;
  method: string;
  path: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  payloadHash: string;
  timestamp?: Date;
}): string {
  return signedRequestHeaders(params).authorization;
}

function endpointFor(config: R2Config, path: string): string {
  return `${config.endpoint}${path.startsWith("/") ? path : `/${path}`}`;
}

export type PutResult = { key: string; etag: string | null };

/** Upload (or overwrite) an object. Content type is sent as-is. */
export async function putObject(params: {
  config: R2Config;
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}): Promise<PutResult> {
  const { config, key, body, contentType } = params;
  const payloadHash = sha256Hex(Buffer.from(body));
  /* One call, one clock read: the headers returned here are exactly the headers
     the signature covers. Nothing below re-derives x-amz-date. */
  const signed = signedRequestHeaders({
    config,
    method: "PUT",
    path: `/${config.bucket}/${key}`,
    headers: {
      host: new URL(config.endpoint).host,
      "content-type": contentType,
      ...(params.cacheControl ? { "cache-control": params.cacheControl } : {}),
    },
    payloadHash,
  });

  const response = await fetch(endpointFor(config, `/${config.bucket}/${key}`), {
    method: "PUT",
    headers: { ...signed.headers, authorization: signed.authorization },
    body: body as unknown as BodyInit,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `R2 upload failed (${response.status} ${response.statusText})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }
  return { key, etag: response.headers.get("etag") };
}

/**
 * Delete an object.
 *
 * Failure is logged, never thrown: the caller is deleting a banner row, and a
 * stranded object in the bucket must not leave the customer-facing database in
 * a half-deleted state. The row is the source of truth.
 */
export async function deleteObject(params: {
  config: R2Config;
  key: string;
}): Promise<boolean> {
  const { config, key } = params;
  const payloadHash = sha256Hex("");
  const signed = signedRequestHeaders({
    config,
    method: "DELETE",
    path: `/${config.bucket}/${key}`,
    headers: { host: new URL(config.endpoint).host },
    payloadHash,
  });

  const response = await fetch(endpointFor(config, `/${config.bucket}/${key}`), {
    method: "DELETE",
    headers: { ...signed.headers, authorization: signed.authorization },
  });

  if (!response.ok && response.status !== 404) {
    console.error(`R2 delete failed for ${key}: ${response.status}`);
    return false;
  }
  return true;
}
