import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import { createHeroCollectionDeps, heroSlotLabel } from "@/lib/hero-collection-repository";
import {
  performHeroCollectionMutation,
  describeHeroResult,
  type HeroMutationResult,
} from "@/lib/hero-collection-service";
import { isHeroCollectionSlot, HERO_SLOT_META } from "@/lib/hero-collections";

type Ctx = { params: Promise<{ slot: string }> };

/**
 * GET /api/admin/hero-collections/[slot] — the parts currently in one slot.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { slot } = await ctx.params;
  if (!isHeroCollectionSlot(slot)) {
    return NextResponse.json({ error: "Unknown hero collection slot." }, { status: 404 });
  }

  const deps = createHeroCollectionDeps();
  const [counts, partIds] = await Promise.all([deps.listSlotCounts(), deps.listItemPartIds(slot)]);
  return NextResponse.json({
    slot,
    label: heroSlotLabel(slot),
    isEnabled: counts.get(slot)?.isEnabled ?? false,
    partIds,
  });
}

/**
 * POST /api/admin/hero-collections/[slot] — add or remove products.
 *
 * The action travels in the body, not the URL, so add and remove share one route
 * and one set of guards. Auth runs FIRST, before any dependency work, so an
 * unauthenticated request cannot reach the database or learn whether a slot has
 * products in it.
 */
export async function POST(request: Request, ctx: Ctx) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { slot } = await ctx.params;
  if (!isHeroCollectionSlot(slot)) {
    return NextResponse.json({ error: "Unknown hero collection slot." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;
  if (action !== "add" && action !== "remove") {
    return NextResponse.json(
      { error: "action must be 'add' or 'remove'." },
      { status: 400 },
    );
  }

  const label = HERO_SLOT_META.find((m) => m.slot === slot)?.label ?? slot;
  const outcome = await performHeroCollectionMutation(
    action,
    { ...(body as Record<string, unknown>), action, slot },
    access.session.user.id,
    createHeroCollectionDeps(),
    label,
  );

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  const result: HeroMutationResult = outcome.result;
  return NextResponse.json({ result, message: describeHeroResult(result) });
}

/**
 * PATCH /api/admin/hero-collections/[slot] — enable or disable a slot.
 *
 * Disabling does not delete anything. A disabled slot falls back to
 * /vehicle-fitment on the storefront, which is the safe direction: a curation
 * mistake then costs the click, not the data.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const { slot } = await ctx.params;
  if (!isHeroCollectionSlot(slot)) {
    return NextResponse.json({ error: "Unknown hero collection slot." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { isEnabled?: unknown } | null;
  if (typeof body?.isEnabled !== "boolean") {
    return NextResponse.json({ error: "isEnabled must be a boolean." }, { status: 400 });
  }

  const deps = createHeroCollectionDeps();
  await deps.ensureSlot(slot, heroSlotLabel(slot));
  await deps.setSlotEnabled(slot, body.isEnabled);
  await deps.audit({
    actorUserId: access.session.user.id,
    action: "hero_collection.set_enabled",
    entityType: "hero_collection",
    entityId: slot,
    metadata: { slot, is_enabled: body.isEnabled, deleted: false },
  });

  return NextResponse.json({ slot, isEnabled: body.isEnabled });
}
