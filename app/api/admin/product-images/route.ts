import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import { getDb } from "@/lib/db";
import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import { part, partCategory } from "@/drizzle/schema";
import { catalogueImageUrls } from "@/lib/catalogue-image-index";
import {
  PRODUCT_IMAGE_STATUS_LABEL,
  deriveProductImageStatus,
  normaliseProductImageQuery,
  productImageStorageState,
  rejectBulkSelection,
  validateProductImageUpload,
  type ProductImageStatus,
} from "@/lib/product-images";
import { readR2Config } from "@/lib/r2-s3";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/product-images
 *
 * A paginated browse of the catalogue with each part's image state attached.
 *
 * The image state is DERIVED, not stored. `lib/catalogue-image-index.ts` reads
 * the two build-time indexes and tells us whether an original, a thumb and a
 * medium exist; nothing is written to the database to record that, so there is
 * no column that can drift out of step with what the storefront actually serves.
 *
 * The R2 asset origin is the one place images come from, and it needs no
 * credentials to READ. Only writing needs them, which is why this endpoint
 * works fully in production today.
 */
export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const query = normaliseProductImageQuery({
    q: url.searchParams.get("q"),
    brand: url.searchParams.get("brand"),
    categoryId: url.searchParams.get("categoryId"),
    page: url.searchParams.get("page"),
    perPage: url.searchParams.get("perPage"),
  });

  const storage = productImageStorageState(
    readR2Config() !== null,
    process.env.CATALOGUE_IMAGE_ORIGIN ?? null,
  );

  try {
    const filters: SQL[] = [];
    if (query.q) {
      const needle = `%${query.q}%`;
      /* Part number and name only. Searching description as well would let a
         stray `%` from the query turn into a pattern that matches every row and
         turn a search into a full catalogue dump. */
      filters.push(or(ilike(part.partNumber, needle), ilike(part.name, needle))!);
    }
    if (query.brand) filters.push(ilike(part.brand, `%${query.brand}%`));
    if (query.categoryId) filters.push(eq(part.categoryId, query.categoryId));

    const where = filters.length ? and(...filters) : undefined;

    const db = getDb();
    const offset = (query.page - 1) * query.perPage;

    const [rows, totals] = await Promise.all([
      db
        .select({
          id: part.id,
          partNumber: part.partNumber,
          name: part.name,
          brand: part.brand,
          categoryId: part.categoryId,
          categoryName: partCategory.name,
        })
        .from(part)
        .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
        .where(where)
        .orderBy(asc(part.partNumber))
        .limit(query.perPage)
        .offset(offset),
      db
        .select({ total: count() })
        .from(part)
        .leftJoin(partCategory, eq(part.categoryId, partCategory.id))
        .where(where),
    ]);

    /* The catalogue image index is keyed by the SKU, which for this catalogue is
       the part id. Resolving it per row keeps the read path identical to the
       storefront's, so an admin sees exactly what a customer sees. */
    const products = rows.map((row) => {
      const urls = catalogueImageUrls(row.id);
      const status = deriveProductImageStatus({
        hasOriginal: urls !== null,
        hasThumb: Boolean(urls?.thumbUrl),
        hasMedium: Boolean(urls?.mediumUrl),
      });
      return {
        id: row.id,
        partNumber: row.partNumber,
        name: row.name,
        brand: row.brand,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        status,
        statusLabel: PRODUCT_IMAGE_STATUS_LABEL[status as ProductImageStatus],
        imageUrl: urls?.imageUrl ?? null,
        thumbUrl: urls?.thumbUrl ?? null,
        mediumUrl: urls?.mediumUrl ?? null,
      };
    });

    return NextResponse.json({
      products,
      total: totals[0]?.total ?? 0,
      page: query.page,
      perPage: query.perPage,
      storage,
    });
  } catch (error) {
    console.error("Product images browse error:", error);
    return NextResponse.json(
      { error: "The product image list could not be loaded." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/product-images - upload one original image.
 *
 * Auth runs FIRST, before storage is touched, so an unauthenticated caller can
 * neither write nor learn whether R2 is configured.
 *
 * The object key is DERIVED on the server from the SKU and the declared content
 * type. A client never supplies a key, so it cannot choose where in the bucket
 * a file lands or address another part's object.
 *
 * There is no bulk variant. Regenerating the catalogue's derivatives is a
 * pipeline job (`scripts/upload-catalogue-derivatives.mjs`), not an admin click,
 * and `rejectBulkSelection` refuses a multi-image request at the edge.
 *
 * There is also no delete. The indexes that decide whether an image is visible
 * are build-time artifacts, so deleting the object would leave the storefront
 * advertising an image that no longer resolves. Replacement is a put over the
 * same key, which is safe and is what "replace" means here.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  // Storage state before any parsing, so a misconfigured environment fails with
  // a configuration message instead of a file-size or type error.
  const config = readR2Config();
  if (!config) {
    const state = productImageStorageState(
      false,
      process.env.CATALOGUE_IMAGE_ORIGIN ?? null,
    );
    return NextResponse.json(
      { error: state.canUpload === true ? "" : state.reason },
      { status: 503 },
    );
  }

  let payload: {
    partId?: unknown;
    sku?: unknown;
    fileName?: unknown;
    contentType?: unknown;
    bytesBase64?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body could not be read." }, { status: 400 });
  }

  /* An array here would be a bulk attempt. Refused before anything is decoded,
     so a large batch cannot be used to push memory or to smuggle a second
     write past a per-file check. */
  const bulk = rejectBulkSelection(Array.isArray(payload) ? payload.length : 1);
  if (bulk) return NextResponse.json({ error: bulk.error }, { status: bulk.status });

  if (typeof payload.partId !== "string" || !payload.partId.trim()) {
    return NextResponse.json({ error: "A product is required." }, { status: 400 });
  }

  const partId = payload.partId.trim();

  // Confirm the part exists before spending effort on an upload for it.
  const existing = await getDb()
    .select({ id: part.id })
    .from(part)
    .where(eq(part.id, partId))
    .limit(1);
  if (existing.length === 0) {
    return NextResponse.json({ error: "That product does not exist." }, { status: 404 });
  }

  const byteLength = estimateBase64Length(payload.bytesBase64);
  const validated = validateProductImageUpload({
    partId,
    sku: typeof payload.sku === "string" && payload.sku.trim() ? payload.sku : partId,
    contentType: payload.contentType,
    byteLength,
    fileName: payload.fileName,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }

  let body: Buffer;
  try {
    body = Buffer.from(String(payload.bytesBase64 ?? ""), "base64");
  } catch {
    return NextResponse.json({ error: "The image data could not be decoded." }, { status: 400 });
  }

  // Validate the declared size against the ACTUAL decoded length. The estimate
  // above is a cheap pre-filter; this is the check that matters, because the
  // client controls the header.
  const revalidated = validateProductImageUpload({
    partId,
    sku: validated.value.sku,
    contentType: validated.value.contentType,
    byteLength: body.byteLength,
  });
  if (!revalidated.ok) {
    return NextResponse.json({ error: revalidated.error }, { status: revalidated.status });
  }
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "The uploaded file was empty." }, { status: 400 });
  }

  const { putObject } = await import("@/lib/r2-s3");
  try {
    const result = await putObject({
      config,
      key: revalidated.value.objectKey,
      body,
      contentType: revalidated.value.contentType,
      /* Derivatives are immutable build-time output. A replaced original must
         not be served from a cache that still holds the old bytes. */
      cacheControl: "public, max-age=0, s-maxage=300",
    });
    return NextResponse.json({
      ok: true,
      partId,
      objectKey: revalidated.value.objectKey,
      contentType: revalidated.value.contentType,
      byteLength: body.byteLength,
      etag: result.etag ?? null,
    });
  } catch (error) {
    /* A storage failure is reported as a failure. Returning success here would
       leave an admin believing an image exists that was never written. */
    console.error("Product image upload error:", error);
    return NextResponse.json(
      { error: "The image could not be stored. The existing image is unchanged." },
      { status: 502 },
    );
  }
}

/** Pre-decode size estimate, used only to reject an obviously oversized body. */
function estimateBase64Length(value: unknown): number {
  if (typeof value !== "string" || !value) return 0;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}
