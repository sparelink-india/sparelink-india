import { NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { promotionalBanner } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { loadAllBanners, normaliseBannerDestination } from "@/lib/promotional-banners";
import { requireAdminApi } from "@/lib/require-role";

/**
 * Banner CRUD — the admin manager's data source.
 *
 * `GET` returns every banner, enabled or not, in display order. `POST` creates
 * one. Mutations live in ./[id] and reordering in ./reorder, so this route
 * stays a single, obvious pair of operations.
 *
 * A new banner is always created DISABLED. A half-finished upload must not be
 * able to appear on the live storefront by accident, so going live is always a
 * separate, explicit action.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        banners: [],
        error:
          "DATABASE_URL is not configured, so banners cannot be managed here.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ banners: await loadAllBanners() });
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const imageKey = typeof body.imageKey === "string" ? body.imageKey.trim() : "";
  if (!imageKey) {
    return NextResponse.json(
      { error: "imageKey is required. Upload the image first." },
      { status: 400 },
    );
  }

  /* A banner can only ever point at an image that lives under the banner
     prefix. Without this an admin could set imageKey to any key in the bucket
     and republish a private object by referencing it. */
  if (!imageKey.startsWith("banners/") || imageKey.includes("..")) {
    return NextResponse.json(
      { error: "imageKey must be a key returned by the banner upload route." },
      { status: 400 },
    );
  }

  /* Sanitised on the way IN as well as on the way out. Storing a raw value
     keeps the admin's intent recoverable in the database, but the storefront
     only ever receives the sanitised form. */
  const rawDestination =
    typeof body.destinationUrl === "string" ? body.destinationUrl.trim() : "";
  const destinationUrl = normaliseBannerDestination(rawDestination);
  if (rawDestination && !destinationUrl) {
    return NextResponse.json(
      {
        error:
          "destinationUrl must be a site-relative path (e.g. /offers) or an absolute http(s) URL.",
      },
      { status: 400 },
    );
  }

  const displayOrder =
    typeof body.displayOrder === "number" && Number.isFinite(body.displayOrder)
      ? Math.trunc(body.displayOrder)
      : 0;

  const id = randomUUID();
  const db = getDb();
  await db.insert(promotionalBanner).values({
    id,
    title,
    imageKey,
    altText: typeof body.altText === "string" ? body.altText.trim() || null : null,
    destinationUrl,
    // Never enabled implicitly.
    isEnabled: false,
    displayOrder,
  });

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "banner.create",
    entityType: "promotional_banner",
    entityId: id,
    metadata: { title, imageKey, isEnabled: false },
  });

  const created = await db
    .select()
    .from(promotionalBanner)
    .where(eq(promotionalBanner.id, id))
    .limit(1);

  return NextResponse.json({ banner: created[0] ?? null, id }, { status: 201 });
}

/**
 * Reorder in one statement.
 *
 * A single `UPDATE ... FROM (VALUES ...)` keeps the whole reorder atomic. The
 * previous alternative — read, renumber in JS, write each row — can interleave
 * with a concurrent edit and leave two banners on the same display order, which
 * makes the storefront order non-deterministic.
 */
export async function PUT(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  const order = body && typeof body === "object" ? (body as { order?: unknown }).order : null;
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json(
      { error: "order must be a non-empty array of banner ids." },
      { status: 400 },
    );
  }

  const ids = order.filter((value): value is string => typeof value === "string");
  if (ids.length !== order.length) {
    return NextResponse.json(
      { error: "order must contain only banner ids." },
      { status: 400 },
    );
  }
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: "order must not repeat a banner id." },
      { status: 400 },
    );
  }

  const db = getDb();
  /* Validate the id set first, so a partial reorder cannot silently orphan
     rows onto a stale order. `inArray` parameterises the list; the ids are
     user input and are never interpolated into SQL text. */
  const existing = await db
    .select({ id: promotionalBanner.id })
    .from(promotionalBanner)
    .where(inArray(promotionalBanner.id, ids));

  if (existing.length !== ids.length) {
    return NextResponse.json(
      { error: "order must list every existing banner exactly once." },
      { status: 400 },
    );
  }

  /* One statement, so the whole reorder is atomic. Every interpolated value in
     this template is a bound parameter, never SQL text. */
  await db.execute(sql`
    UPDATE promotional_banner AS b
    SET display_order = v.position, updated_at = now()
    FROM (VALUES ${sql.join(
      ids.map((id, position) => sql`(${id}::text, ${position}::integer)`),
      sql`, `,
    )}) AS v(id, position)
    WHERE b.id = v.id
  `);

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "banner.reorder",
    entityType: "promotional_banner",
    metadata: { order: ids },
  });

  return NextResponse.json({ banners: await loadAllBanners() });
}
