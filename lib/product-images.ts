/**
 * Product images - pure rules and vocabulary.
 *
 * READ THE ARCHITECTURE BEFORE CHANGING ANYTHING HERE.
 *
 * The existing catalogue image architecture is NOT a database column and NOT a
 * per-part row. It is two build-time JSON indexes in `data/`:
 *
 *   catalogue-image-index.json       SKU -> original extension
 *   catalogue-image-derivatives.json SKU -> which derivatives exist
 *
 * resolved by `lib/catalogue-image-index.ts`, which turns a SKU into
 * `/catalogue-images/<sanitised-sku><ext>` on the configured asset origin. The
 * binaries themselves live in R2. So the R2 object key is derived from the
 * SKU, not stored anywhere, and there is no per-part image record to edit.
 *
 * That shapes this module completely:
 *
 *   - an image "status" is a DERIVATION from the two indexes, never a stored
 *     flag that could drift out of step with what is actually served
 *   - an upload writes one R2 object at a key this module derives, so an admin
 *     cannot choose where in the bucket a file lands
 *   - nothing here deletes. `deleteObject` exists in `lib/r2-s3.ts` and is
 *     deliberately NOT re-exported, because the indexes that decide whether an
 *     image is visible cannot be written from a request, so a delete would
 *     produce an object the index still advertises
 *
 * R2 CREDENTIALS ARE NOT CONFIGURED IN PRODUCTION. That is not an error state
 * to paper over: read, preview and status work fully without them, and upload
 * reports the configuration requirement rather than pretending to succeed.
 */

/** The R2 key prefix that matches the existing served paths exactly. */
export const CATALOGUE_IMAGE_KEY_PREFIX = "catalogue-images/";

/** Served path, same prefix. Used to derive the R2 key and to show previews. */
export function catalogueImagePublicPathFor(sku: string, ext: string): string {
  return `/${CATALOGUE_IMAGE_KEY_PREFIX}${encodeURIComponent(
    sanitizeCatalogueImageKey(sku),
  )}${ext}`;
}

/**
 * The existing sanitiser from `lib/catalogue-image-index.ts`, reproduced
 * verbatim rather than imported so this module stays free of `fs` and can run
 * in the browser bundle. If the two ever diverge, this one is the one that
 * decides where bytes land, so it must keep matching the index that decides
 * where they are read from.
 */
export function sanitizeCatalogueImageKey(sku: string): string {
  return sku.replace(/[^A-Za-z0-9._-]+/g, "_");
}

/**
 * The object key for a SKU.
 *
 * TRAVERSAL IS STRUCTURALLY IMPOSSIBLE, not filtered. The prefix is a constant
 * and the only variable part is passed through a whitelist that has no `/` and
 * no `..`, so no input can escape the prefix or address another part's object.
 * A caller cannot pass a key in; it can only pass a SKU.
 */
export function catalogueImageObjectKey(sku: string, ext: string): string | null {
  const normalisedExt = ext.trim().toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(normalisedExt)) return null;
  const key = sanitizeCatalogueImageKey(sku.trim());
  if (!key || key.length > 160) return null;
  return `${CATALOGUE_IMAGE_KEY_PREFIX}${key}${normalisedExt}`;
}

/** Extensions the existing index can hold. Matches the derivatives pipeline. */
export const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/**
 * Content types accepted for upload.
 *
 * Deliberately narrower than ALLOWED_EXTENSIONS: a `.webp` is a legitimate
 * stored original, but a browser will only produce a few of these types from a
 * file picker, so the upload surface is small and explicit rather than
 * "whatever the extension says".
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/webp", ".webp"],
]);

/** 8 MB. A catalogue raster is far smaller; this only exists to stop a huge file. */
export const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;

export type ProductImageStatus = "original-and-derivatives" | "original-only" | "missing";

/**
 * What a part's image looks like, derived from the two indexes.
 *
 *   original-and-derivatives  original plus thumb and medium: the fast path
 *   original-only            original exists, no derivatives generated yet
 *   missing                  no original: the card falls back to a placeholder
 *
 * `hasThumb`/`hasMedium` are reported separately rather than folded into the
 * status, because an admin deciding whether to regenerate a derivative needs to
 * know which one is absent, and a three-value enum cannot say that.
 */
export function deriveProductImageStatus(input: {
  hasOriginal: boolean;
  hasThumb: boolean;
  hasMedium: boolean;
}): ProductImageStatus {
  if (!input.hasOriginal) return "missing";
  return input.hasThumb && input.hasMedium ? "original-and-derivatives" : "original-only";
}

export const PRODUCT_IMAGE_STATUS_LABEL: Record<ProductImageStatus, string> = {
  "original-and-derivatives": "Original + derivatives",
  "original-only": "Original only, no derivatives",
  missing: "No image",
};

/* ----------------------------------------------------------------- upload */

export type ProductImageUploadRequest = {
  partId: string;
  /** The SKU the image index is keyed by. Normally the part id. */
  sku: string;
  contentType: unknown;
  byteLength: unknown;
  /** Declared file name. Used for nothing except a clearer error message. */
  fileName?: unknown;
};

export type ValidatedProductImageUpload = {
  sku: string;
  /** The exact key the bytes will be written to. Derived, never client-supplied. */
  objectKey: string;
  ext: string;
  contentType: string;
  byteLength: number;
};

export type ProductImageUploadRejection = {
  ok: false;
  status: 400;
  error: string;
};

function reject(error: string): ProductImageUploadRejection {
  return { ok: false, status: 400, error };
}

/**
 * Validate an upload.
 *
 * ORDER MATTERS. Content type is checked before size, because an unsupported
 * type is the more useful error and a 20 MB GIF should not be reported as
 * "too big" when the real problem is that it is not an image at all.
 */
export function validateProductImageUpload(
  request: ProductImageUploadRequest,
): { ok: true; value: ValidatedProductImageUpload } | ProductImageUploadRejection {
  const sku = typeof request.sku === "string" ? request.sku.trim() : "";
  if (!sku || sku.length > 160) {
    return reject("The product does not have a usable image key.");
  }
  // The sanitised key must not be empty and must not have collapsed to dots.
  const sanitised = sanitizeCatalogueImageKey(sku);
  if (!sanitised || sanitised === "." || sanitised === "..") {
    return reject("The product does not have a usable image key.");
  }

  const contentType =
    typeof request.contentType === "string" ? request.contentType.trim().toLowerCase() : "";
  const ext = ALLOWED_UPLOAD_CONTENT_TYPES.get(contentType);
  if (!ext) {
    return reject(
      "Unsupported image type. Upload a PNG, JPEG or WebP file.",
    );
  }

  const byteLength = request.byteLength;
  if (typeof byteLength !== "number" || !Number.isFinite(byteLength) || byteLength <= 0) {
    return reject("The uploaded file was empty or its size could not be read.");
  }
  if (byteLength > MAX_PRODUCT_IMAGE_BYTES) {
    return reject(
      `The file is larger than the ${Math.round(MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024)} MB limit.`,
    );
  }

  const objectKey = catalogueImageObjectKey(sku, ext);
  if (!objectKey) {
    // Unreachable given the checks above; kept so a future extension rule
    // cannot silently produce an unwriteable upload.
    return reject("The image could not be stored at a valid location.");
  }

  return { ok: true, value: { sku, objectKey, ext, contentType, byteLength } };
}

/* ------------------------------------------------------------------ search */

export type ProductImageQuery = {
  q: string;
  brand: string;
  categoryId: string;
  page: number;
  perPage: number;
};

export const PRODUCT_IMAGE_MAX_PER_PAGE = 60;
export const PRODUCT_IMAGE_MAX_PAGE = 5000;

export function normaliseProductImageQuery(params: {
  q?: unknown;
  brand?: unknown;
  categoryId?: unknown;
  page?: unknown;
  perPage?: unknown;
}): ProductImageQuery {
  /* Text filters are strings only. A number here would be a bug upstream, and
     coercing it would hide that rather than surface it. */
  const text = (v: unknown, limit = 120) =>
    typeof v === "string" ? v.trim().slice(0, limit) : "";
  /* page and perPage additionally accept a number, because a caller may hand
     this an already-parsed query param, and silently falling back to the
     default would turn "page 5" into "page 1" with no signal. */
  const numberish = (v: unknown) => {
    const raw = typeof v === "number" ? String(v) : text(v, 12);
    return Number.parseInt(raw, 10);
  };
  const page = numberish(params.page);
  const perPage = numberish(params.perPage);
  return {
    q: text(params.q),
    brand: text(params.brand),
    categoryId: text(params.categoryId),
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, PRODUCT_IMAGE_MAX_PAGE) : 1,
    perPage:
      Number.isFinite(perPage) && perPage >= 1
        ? Math.min(perPage, PRODUCT_IMAGE_MAX_PER_PAGE)
        : 24,
  };
}

/**
 * Bulk selection is refused outright.
 *
 * The catalogue is 9,017 parts. There is no batch rewrite anywhere in this
 * module, and this constant exists so that if a future request ever tries to
 * pass more than a handful of ids, it fails at the edge with a clear message
 * instead of arriving at a query builder that would happily write it.
 *
 * Phase F is deliberately a single-image-at-a-time tool. Regenerating
 * derivatives across the catalogue is a pipeline job, run by
 * `scripts/upload-catalogue-derivatives.mjs`, not an admin click.
 */
export const PRODUCT_IMAGE_MAX_BULK_SELECTION = 0;

export function rejectBulkSelection(count: number): ProductImageUploadRejection | null {
  if (count <= PRODUCT_IMAGE_MAX_BULK_SELECTION) return null;
  return reject(
    "Bulk image selection is not supported here. Regenerating catalogue images is a pipeline job, not an admin action.",
  );
}

/* ------------------------------------------------- storage configuration */

/**
 * The exact reason upload is unavailable, or null when it is available.
 *
 * Returned rather than thrown so the admin page can render an honest banner
 * before an admin tries anything. `readR2Config()` is the single source of
 * truth; this does not re-check the environment variables itself, because a
 * second, subtly different check is how a module ends up reporting "configured"
 * and then failing on the first request.
 */
export function productImageStorageState(
  configured: boolean,
  assetOrigin: string | null,
): { canUpload: true } | { canUpload: false; reason: string; assetOrigin: string | null } {
  if (configured) return { canUpload: true };
  return {
    canUpload: false,
    reason:
      "Product image uploads are not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME (plus CLOUDFLARE_ACCOUNT_ID or R2_ENDPOINT) in the deployment environment. Existing images remain fully browsable.",
    assetOrigin,
  };
}
