import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { promotionalBanner } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { normaliseBannerDestination } from "@/lib/promotional-banners";
import { requireAdminApi } from "@/lib/require-role";
import { deleteObject, readR2Config } from "@/lib/r2-s3";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Update or delete ONE banner.
 *
 * `PATCH` accepts only the fields the manager actually edits, and each is
 * applied only when present — so a client that sends `{ isEnabled: true }`
 * cannot accidentally blank the title. There is no blanket field assignment and
 * no `id` in the body: the id comes from the path, so a body cannot claim to be
 * a different banner.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const patch: Partial<typeof promotionalBanner.$inferInsert> = {};

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title cannot be empty." }, { status: 400 });
    }
    patch.title = title;
  }

  if ("altText" in body) {
    patch.altText =
      typeof body.altText === "string" ? body.altText.trim() || null : null;
  }

  if ("destinationUrl" in body) {
    const raw =
      typeof body.destinationUrl === "string" ? body.destinationUrl.trim() : "";
    const normalised = normaliseBannerDestination(raw);
    // A rejected non-empty value is an error, not a silent clear: silently
    // dropping it would make a typo look like it worked.
    if (raw && !normalised) {
      return NextResponse.json(
        {
          error:
            "destinationUrl must be a site-relative path (e.g. /offers) or an absolute http(s) URL. Clear the field to make the banner non-clickable.",
        },
        { status: 400 },
      );
    }
    patch.destinationUrl = normalised;
  }

  if ("isEnabled" in body) {
    if (typeof body.isEnabled !== "boolean") {
      return NextResponse.json(
        { error: "isEnabled must be a boolean." },
        { status: 400 },
      );
    }
    patch.isEnabled = body.isEnabled;
  }

  if ("displayOrder" in body) {
    if (
      typeof body.displayOrder !== "number" ||
      !Number.isFinite(body.displayOrder)
    ) {
      return NextResponse.json(
        { error: "displayOrder must be a number." },
        { status: 400 },
      );
    }
    patch.displayOrder = Math.trunc(body.displayOrder);
  }

  /* Replacing the image. The NEW key must be one the upload route issued, and
     the OLD object is removed only after the row has been updated, so a failure
     mid-way leaves a working banner rather than a row pointing at nothing. */
  let supersededKey: string | null = null;
  if ("imageKey" in body) {
    const imageKey = typeof body.imageKey === "string" ? body.imageKey.trim() : "";
    if (!imageKey.startsWith("banners/") || imageKey.includes("..")) {
      return NextResponse.json(
        { error: "imageKey must be a key returned by the banner upload route." },
        { status: 400 },
      );
    }

    const db = getDb();
    const current = await db
      .select({ imageKey: promotionalBanner.imageKey })
      .from(promotionalBanner)
      .where(eq(promotionalBanner.id, id))
      .limit(1);
    supersededKey = current[0]?.imageKey ?? null;
    patch.imageKey = imageKey;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No editable fields were provided." },
      { status: 400 },
    );
  }

  const db = getDb();
  const updated = await db
    .update(promotionalBanner)
    .set(patch)
    .where(eq(promotionalBanner.id, id))
    .returning();

  if (updated.length === 0) {
    return NextResponse.json({ error: "Banner not found." }, { status: 404 });
  }

  if (supersededKey && supersededKey !== patch.imageKey) {
    const config = readR2Config();
    if (config) {
      try {
        await deleteObject({ config, key: supersededKey });
      } catch (error) {
        // Never fails the request: the row is already correct.
        console.error(
          `Superseded banner image ${supersededKey} was not removed:`,
          error,
        );
      }
    } else {
      console.warn(
        `Superseded banner image ${supersededKey} was not removed: R2 is not configured.`,
      );
    }
  }

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "banner.update",
    entityType: "promotional_banner",
    entityId: id,
    metadata: { fields: Object.keys(patch) },
  });

  return NextResponse.json({ banner: updated[0] });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { id } = await ctx.params;
  const db = getDb();

  /* Read the key first, then delete the row, then the object. The row is the
     source of truth: a stranded object costs storage, whereas a live row
     pointing at a deleted object would show a broken banner to customers. */
  const existing = await db
    .select({ imageKey: promotionalBanner.imageKey })
    .from(promotionalBanner)
    .where(eq(promotionalBanner.id, id))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Banner not found." }, { status: 404 });
  }

  await db.delete(promotionalBanner).where(eq(promotionalBanner.id, id));

  const imageKey = existing[0].imageKey;
  const config = readR2Config();
  if (!config) {
    console.warn(
      `Banner image ${imageKey} was orphaned: R2 is not configured on this deployment.`,
    );
  } else {
    try {
      await deleteObject({ config, key: imageKey });
    } catch (error) {
      console.error(`Banner image ${imageKey} was not removed:`, error);
    }
  }

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "banner.delete",
    entityType: "promotional_banner",
    entityId: id,
    metadata: { imageKey },
  });

  return NextResponse.json({ deleted: true, id });
}
