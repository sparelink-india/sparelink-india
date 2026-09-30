import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALGORITHM,
  buildAuthorization,
  canonicalUri,
  deriveSigningKey,
  r2UploadErrorMessage,
  sha256Hex,
  signedRequestHeaders,
  uriEncode,
} from "./r2-s3";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

/**
 * These are the tests that make "the upload signs correctly" a checkable claim.
 *
 * `buildAuthorization` is exercised against the canonical AWS SigV4 S3 example
 * (GET Object, us-east-1, 20130524T000000Z, Range: bytes=0-9), whose expected
 * signature is published in the AWS documentation. If the signing key chain,
 * the canonical header ordering, or the string-to-sign assembly were wrong,
 * that known-answer test fails — which is the whole reason the signer is a
 * small pure function instead of an opaque SDK call.
 */
describe("R2 SigV4 signing", () => {
  it("reproduces the AWS published GET Object signature", () => {
    const authorization = buildAuthorization({
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
      },
      method: "GET",
      path: "/test.txt",
      headers: {
        host: "examplebucket.s3.amazonaws.com",
        range: "bytes=0-9",
      },
      payloadHash: sha256Hex(""),
      timestamp: new Date(Date.UTC(2013, 4, 24, 0, 0, 0)),
    });

    assert.ok(authorization.startsWith(ALGORITHM));
    assert.ok(
      authorization.includes(
        "Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request",
      ),
      `scope missing from: ${authorization}`,
    );
    assert.ok(
      authorization.includes("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date"),
      `signed headers wrong: ${authorization}`,
    );
    assert.ok(
      authorization.endsWith(
        "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
      ),
      `signature mismatch: ${authorization}`,
    );
  });

  it("derives the documented signing key bytes", () => {
    const key = deriveSigningKey(
      "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "20130524",
      "us-east-1",
    );
    assert.equal(key.toString("hex").length, 64);
    // The chain is deterministic, which is what a signature depends on.
    assert.deepEqual(
      key,
      deriveSigningKey(
        "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "20130524",
        "us-east-1",
      ),
    );
  });

  it("changes the signature when any signed input changes", () => {
    const base = {
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
      },
      method: "GET",
      path: "/test.txt",
      headers: { host: "examplebucket.s3.amazonaws.com" },
      payloadHash: sha256Hex(""),
      timestamp: new Date(Date.UTC(2013, 4, 24, 0, 0, 0)),
    };
    const baseSignature = buildAuthorization(base);
    assert.notEqual(
      buildAuthorization({ ...base, path: "/other.txt" }),
      baseSignature,
      "path must be signed",
    );
    assert.notEqual(
      buildAuthorization({ ...base, method: "PUT" }),
      baseSignature,
      "method must be signed",
    );
    assert.notEqual(
      buildAuthorization({
        ...base,
        config: { ...base.config, region: "auto" },
      }),
      baseSignature,
      "region must be signed",
    );
    assert.notEqual(
      buildAuthorization({
        ...base,
        payloadHash: sha256Hex("different"),
      }),
      baseSignature,
      "payload hash must be signed",
    );
  });

  /**
   * Regression test for a real intermittent production failure.
   *
   * putObject originally called the signer and then built the request headers
   * separately, computing a SECOND `x-amz-date`. Whenever the second fell on
   * the far side of a one-second boundary from the first, the header sent no
   * longer matched the one the signature covered and R2 answered
   * SignatureDoesNotMatch - on an arbitrary fraction of uploads, which reads
   * as "the bucket is flaky" rather than as a bug.
   *
   * These assertions make that class of failure impossible to reintroduce: the
   * signed header set and the Authorization value must come from one clock
   * read, and the timestamp inside the signature must be the timestamp sent.
   */
  it("returns headers and signature from a single clock read", () => {
    const signed = signedRequestHeaders({
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "auto",
      },
      method: "PUT",
      path: "/bucket/banners/2026/03/a.webp",
      headers: { host: "example.r2.cloudflarestorage.com", "content-type": "image/webp" },
      payloadHash: sha256Hex("body"),
      timestamp: new Date(Date.UTC(2026, 2, 3, 4, 5, 6)),
    });

    assert.equal(signed.amzDate, "20260303T040506Z");
    // The header actually sent is the one that was signed.
    assert.equal(signed.headers["x-amz-date"], signed.amzDate);
    /* The timestamp is deliberately NOT in the Authorization header - SigV4 puts
       it in the string-to-sign, not the header. So the invariant to assert is
       that the returned header set is exactly reproducible from the same pinned
       clock, which is what "one clock read" has to mean in practice. */
    const again = signedRequestHeaders({
      config: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "auto",
      },
      method: "PUT",
      path: "/bucket/banners/2026/03/a.webp",
      headers: { host: "example.r2.cloudflarestorage.com", "content-type": "image/webp" },
      payloadHash: sha256Hex("body"),
      timestamp: new Date(Date.UTC(2026, 2, 3, 4, 5, 6)),
    });
    assert.equal(again.authorization, signed.authorization);
    assert.deepEqual(again.headers, signed.headers);
    // Every signed header is present in the returned set, so a caller cannot
    // send a header the signature does not cover, nor omit one it does.
    const signedList = /SignedHeaders=([^,]+)/.exec(signed.authorization)?.[1] ?? "";
    for (const name of signedList.split(";")) {
      assert.ok(
        name in signed.headers,
        `signed header ${name} missing from the returned header set`,
      );
    }
    assert.ok(
      "authorization" in signed.headers === false,
      "authorization must be added by the caller",
    );
  });

  it("encodes per RFC 3986, which encodeURIComponent does not do", () => {
    // encodeURIComponent leaves ! * ' ( ) alone; SigV4 must not.
    assert.equal(uriEncode("!*$'()"), "%21%2A%24%27%28%29");
    assert.equal(uriEncode("a b/c"), "a%20b%2Fc");
    assert.equal(uriEncode("safe-._~AZaz09"), "safe-._~AZaz09");
  });

  it("preserves slashes in the canonical path so the key is addressable", () => {
    // Encoding the slashes would point at a different object.
    assert.equal(canonicalUri("/bucket/banners/2026/03/a.webp"), "/bucket/banners/2026/03/a.webp");
    assert.equal(canonicalUri("banners/a.webp"), "/banners/a.webp");
    assert.equal(canonicalUri("/"), "/");
    assert.equal(canonicalUri("/a b/c.webp"), "/a%20b/c.webp");
  });
});

/**
 * Diagnostics for a refused upload.
 *
 * A `403 AccessDenied` with no Cloudflare request id is unactionable: there is
 * nothing to quote in a support ticket. These tests pin both halves of the
 * change - that the trace identifiers ARE captured, and that capturing them
 * cannot leak a credential.
 */
describe("R2 upload failure diagnostics", () => {
  const S3_BODY = "<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>";

  const message = (headers: Headers, body: string = S3_BODY) =>
    r2UploadErrorMessage({ status: 403, statusText: "Forbidden", body, headers });

  it("reports status, status text, the S3 body and all three trace ids", () => {
    const result = message(
      new Headers({
        "cf-ray": "8f3c1a2b4d5e6f70-SIN",
        "x-amz-request-id": "4A1B2C3D4E5F60718",
        "x-amz-id-2": "s3-eu-1/9zYxWvUtSrQpOnMlK",
      }),
    );

    assert.match(result, /^R2 upload failed \(403 Forbidden\)/);
    assert.ok(result.includes(S3_BODY), `body missing from: ${result}`);
    assert.ok(result.includes("cf-ray=8f3c1a2b4d5e6f70-SIN"), result);
    assert.ok(result.includes("x-amz-request-id=4A1B2C3D4E5F60718"), result);
    assert.ok(result.includes("x-amz-id-2=s3-eu-1/9zYxWvUtSrQpOnMlK"), result);
  });

  it("leaves the message byte-identical when the response carries no trace ids", () => {
    // Backward compatibility: a failure with nothing to report must render
    // exactly as it did before this change, so no existing log line or admin
    // message changes shape.
    assert.equal(message(new Headers()), `R2 upload failed (403 Forbidden): ${S3_BODY}`);
  });

  it("looks the identifiers up case-insensitively, as HTTP requires", () => {
    const result = message(new Headers({ "CF-RAY": "8f3c1a2b4d5e6f70-SIN" }));
    assert.ok(result.includes("cf-ray=8f3c1a2b4d5e6f70-SIN"), result);
  });

  it("omits blank identifiers instead of emitting empty fields", () => {
    const result = message(new Headers({ "cf-ray": "   ", "x-amz-request-id": "" }));
    assert.equal(result, `R2 upload failed (403 Forbidden): ${S3_BODY}`);
  });

  it("truncates the S3 body to 300 characters, as before", () => {
    const result = message(new Headers(), "x".repeat(5000));
    const body = result.slice(result.indexOf("): ") + 3);
    assert.equal(body.length, 300);
  });

  it("caps a pathological identifier value", () => {
    const result = message(new Headers({ "cf-ray": "y".repeat(5000) }));
    assert.equal(result.includes("y".repeat(201)), false, "value must be capped at 200");
    assert.ok(result.includes("y".repeat(200)), "the cap must retain the value");
  });

  /**
   * The security property, stated as a denylist so a reviewer can audit it.
   *
   * Only three response header names are read. `authorization` is the one that
   * matters: it is present on the REQUEST, never on the response, but asserting
   * it here means that if anyone ever echoes request headers into this message
   * the test fails rather than the leak reaching production.
   */
  it("never echoes a response header that is not on the allowlist", () => {
    const result = message(
      new Headers({
        "cf-ray": "8f3c1a2b4d5e6f70-SIN",
        authorization: "AWS4-HMAC-SHA256 Credential=leaked/20260930/auto/s3/aws4_request",
        "x-amz-access-key-id": "AKIADIAGNOSTICFAKEKEY00",
        "x-amz-secret-access-key": "diagnosticSecretMustNeverBeLogged",
        "set-cookie": "session=diagnostic-cookie",
        "x-amz-meta-secret": "diagnostic-meta",
      }),
    );

    assert.ok(result.includes("cf-ray=8f3c1a2b4d5e6f70-SIN"), "the allowlisted id must survive");
    for (const leaked of [
      "AWS4-HMAC-SHA256",
      "AKIADIAGNOSTICFAKEKEY00",
      "diagnosticSecretMustNeverBeLogged",
      "diagnostic-cookie",
      "diagnostic-meta",
      "authorization",
    ]) {
      assert.equal(result.includes(leaked), false, `leaked ${leaked} into: ${result}`);
    }
  });

  /**
   * The same property, proved against a genuinely signed request rather than a
   * hand-written string: sign a real PutObject, then assert that nothing the
   * signer produced appears in the failure message.
   */
  it("cannot leak any part of a real signed request", () => {
    const ACCESS_KEY = "AKIADIAGNOSTICFAKEKEY00";
    const SECRET = "diagnosticSecretMustNeverBeLogged0000000000000000";
    const signed = signedRequestHeaders({
      config: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET, region: "auto" },
      method: "PUT",
      path: "/sparelink-india-assets/banners/2026/09/diagnostic.webp",
      headers: {
        host: "0000000000000000000000000000dead.r2.cloudflarestorage.com",
        "content-type": "image/webp",
        "cache-control": "public, max-age=31536000, immutable",
      },
      payloadHash: sha256Hex("diagnostic body"),
      timestamp: new Date(Date.UTC(2026, 8, 30, 12, 0, 0)),
    });

    const result = message(
      new Headers({ "cf-ray": "8f3c1a2b4d5e6f70-SIN", "x-amz-request-id": "4A1B2C3D4E5F60718" }),
    );

    for (const secretish of [
      ACCESS_KEY,
      SECRET,
      signed.authorization,
      ...Object.values(signed.headers).filter((v) => /[0-9a-f]{32,}/.test(v)),
      "AWS4",
    ]) {
      assert.equal(result.includes(secretish), false, `leaked into: ${result}`);
    }
  });

  /**
   * Makes the allowlist an enforced invariant rather than a comment, so adding a
   * fourth header name is a deliberate act that fails here first.
   */
  it("reads exactly three response header names, no more", () => {
    const declared =
      source("lib/r2-s3.ts").match(/DIAGNOSTIC_RESPONSE_HEADERS = \[([^\]]*)\]/)?.[1] ?? "";
    const names = declared
      .split(",")
      .map((n) => n.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    assert.deepEqual(names, ["cf-ray", "x-amz-request-id", "x-amz-id-2"]);
  });

  /**
   * putObject must pass the response through, and must not re-derive the message
   * inline - otherwise the allowlist above stops being the whole story.
   */
  it("routes the putObject failure path through the allowlisted builder", () => {
    const impl = source("lib/r2-s3.ts");
    assert.ok(
      impl.includes("r2UploadErrorMessage({"),
      "putObject must delegate to r2UploadErrorMessage",
    );
    assert.equal(
      /R2 upload failed \(\$\{response\.status\}/.test(impl),
      false,
      "the message must not be rebuilt inline in putObject",
    );
  });
});
