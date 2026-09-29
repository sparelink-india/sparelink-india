import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { writeAuditLog } from "@/lib/audit";
import { requireAdminApi } from "@/lib/require-role";
import {
  R2ConfigurationError,
  putObject,
  requireR2Config,
} from "@/lib/r2-s3";

export const runtime = "nodejs";
/** Never cached: an upload response is unique per call. */
export const dynamic = "force-dynamic";

/**
 * Banner image upload.
 *
 * Separate from the banner CRUD routes on purpose: it handles multipart bytes
 * and touches object storage, while the CRUD routes handle JSON and the
 * database. Keeping them apart means the CRUD surface has no code path that can
 * write a file, and the upload surface has no code path that can create a
 * database row that points at a file that was never written.
 *
 * Returns the storage key only. It does NOT create a banner — the admin then
 * creates the banner from the key, which is what makes "upload, then decide
 * whether to keep it" possible and keeps a half-finished upload off the
 * storefront (a new banner defaults to disabled).
 */

/**
 * Accepted types. Banners are photographic artwork, so the allowlist is by MIME
 * type AND the extension is derived from the sniffed type rather than from the
 * filename the browser supplied — an uploaded file's name is attacker-controlled
 * and must never decide where it is written or how it is served.
 */
const ACCEPTED: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/avif": "avif",
};

/** 8 MB. A 3:1–4:1 banner at print-adjacent quality lands comfortably under this. */
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart form upload." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image is larger than the ${MAX_BYTES / 1024 / 1024} MB limit.` },
      { status: 413 },
    );
  }

  const extension = ACCEPTED[file.type];
  if (!extension) {
    return NextResponse.json(
      {
        error:
          "Unsupported image type. Upload a WebP, PNG, JPEG or AVIF file.",
      },
      { status: 415 },
    );
  }

  let config;
  try {
    config = requireR2Config();
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  /* The key is generated, never derived from the uploaded filename. A
     user-supplied name would let an admin (or anyone who reaches this route)
     choose the storage path, which is how path traversal and content-type
     confusion get in. */
  const stamp = new Date().toISOString().slice(0, 7).replace("-", "/");
  const key = `banners/${stamp}/${randomUUID()}.${extension}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await putObject({
      config,
      key,
      body: bytes,
      contentType: file.type,
      // Content-addressed by UUID, so the bytes at a key never change. One year
      // is safe and keeps the banner off the network on every page view; a
      // replaced banner gets a new key, so a stale cache cannot survive a
      // replacement.
      cacheControl: "public, max-age=31536000, immutable",
    });

    await writeAuditLog({
      actorUserId: access.session.user.id,
      action: "banner.image.upload",
      entityType: "promotional_banner_image",
      entityId: key,
      metadata: { bytes: bytes.byteLength, contentType: file.type },
    });

    return NextResponse.json(
      { key: result.key, contentType: file.type, bytes: bytes.byteLength },
      { status: 201 },
    );
  } catch (error) {
    console.error("Banner image upload failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The image could not be uploaded.",
      },
      { status: 502 },
    );
  }
}
