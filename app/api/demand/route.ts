import { NextResponse } from "next/server";

import { requireBuyerApi, requireDealerApi } from "@/lib/require-role";
import {
  captureDemand,
  listDemandForDealer,
  listDemandForUser,
  updateDemandStatus,
  type DemandSource,
  isDemandSource,
} from "@/lib/procurement/demand-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CUSTOMER / DEALER DEMAND.
 *
 * POST records what somebody actually asked for when the shop could not supply
 * it. GET returns the caller's OWN lines and nothing else — there is no
 * `?userId=` parameter, precisely so this endpoint cannot be turned into a way
 * to read another customer's demand.
 *
 * `firmId` is NOT an accepted field. Firm is resolved server-side from the
 * listing that carries the part; a posted firm value is ignored rather than
 * trusted.
 */

type Actor = { userId: string; role: string; dealerId: string | null };

export async function POST(request: Request) {
  /* A dealer may raise demand; a buyer may too. Admin-only procurement routes
     live under /api/admin. Trying both gates means a dealer session is not
     rejected just because it is not a buyer. */
  const buyer = await requireBuyerApi();
  const dealer = buyer && !("error" in buyer) ? null : await requireDealerApi();
  const access = buyer && !("error" in buyer) ? buyer : dealer;
  if (!access || "error" in access) {
    return (access as { error: NextResponse }).error;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const partId = typeof body.partId === "string" ? body.partId : "";
  const requestedQty = Number(body.requestedQty);
  const source = body.source as DemandSource;

  if (!partId) {
    return NextResponse.json({ error: "partId is required." }, { status: 400 });
  }
  if (!Number.isFinite(requestedQty) || !Number.isInteger(requestedQty) || requestedQty <= 0) {
    return NextResponse.json(
      { error: "requestedQty must be a positive integer." },
      { status: 400 },
    );
  }
  if (!isDemandSource(source)) {
    return NextResponse.json({ error: "Unsupported demand source." }, { status: 400 });
  }

  const actor: Actor = {
    userId: access.session.user.id,
    role: String(access.session.user.role ?? "buyer"),
    dealerId:
      access.session.user.role === "dealer"
        ? ((access.session.user as { dealerId?: string | null }).dealerId ?? null)
        : null,
  };

  /* Idempotency key is generated SERVER-side when the client did not supply
     one. That still de-duplicates the common case — the same double-click
     arriving twice within one render pass — without trusting a client token,
     and a client-supplied key is honoured when present so a retried request
     after a timeout resolves to the same row. */
  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 120)
      : `auto:${actor.userId}:${partId}:${requestedQty}`;

  const result = await captureDemand({
    partId,
    requestedQty,
    source,
    actor,
    idempotencyKey,
    orderId: typeof body.orderId === "string" ? body.orderId : null,
    orderItemId: typeof body.orderItemId === "string" ? body.orderItemId : null,
    note:
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 1000)
        : null,
    notifyEmail:
      typeof body.notifyEmail === "string" && body.notifyEmail.trim()
        ? body.notifyEmail.trim().slice(0, 200)
        : null,
    notifyPhone:
      typeof body.notifyPhone === "string" && body.notifyPhone.trim()
        ? body.notifyPhone.trim().slice(0, 40)
        : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code === "not_found" ? 404 : 400 },
    );
  }

  return NextResponse.json(
    { demandId: result.demandId, partId: result.partId, created: result.created },
    { status: result.created ? 201 : 200 },
  );
}

export async function GET() {
  /* Buyers see their own lines; a dealer session sees its own lines. There is
     deliberately no query parameter to widen either scope. */
  const buyer = await requireBuyerApi();
  if (!("error" in buyer)) {
    return NextResponse.json({ demand: await listDemandForUser(buyer.session.user.id) });
  }

  const dealer = await requireDealerApi();
  if ("error" in dealer) return dealer.error;

  const dealerId = (dealer.session.user as { dealerId?: string | null }).dealerId;
  return NextResponse.json({
    demand: dealerId ? await listDemandForDealer(dealerId) : [],
  });
}

/** PATCH advances one of the caller's OWN demand lines. */
export async function PATCH(request: Request) {
  const access = await requireBuyerApi();
  if ("error" in access) {
    return access.error;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const demandId = typeof body?.demandId === "string" ? body.demandId : "";
  const nextStatus = typeof body?.status === "string" ? body.status : "";
  if (!demandId || !nextStatus) {
    return NextResponse.json(
      { error: "demandId and status are required." },
      { status: 400 },
    );
  }

  const result = await updateDemandStatus({
    demandId,
    nextStatus,
    actor: {
      userId: access.session.user.id,
      role: String(access.session.user.role ?? "buyer"),
      dealerId: null,
    },
  });

  if (!result.ok) {
    const status =
      result.code === "not_found"
        ? 404
        : result.code === "forbidden"
          ? 403
          : result.code === "illegal_transition"
            ? 409
            : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
