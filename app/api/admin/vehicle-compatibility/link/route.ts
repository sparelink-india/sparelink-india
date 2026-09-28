import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import { createCompatibilityMutationDeps } from "@/lib/vehicle-compatibility-repository";
import { performCompatibilityMutation } from "@/lib/vehicle-compatibility-service";

/**
 * POST /api/admin/vehicle-compatibility/link
 *
 * Links products to one vehicle. Admin-only, and the only write path into
 * `part_vehicle_compatibility` in the application.
 *
 * The vehicle-master and hero-class work is deliberately NOT here. This route
 * touches one table and nothing else: no `vehicle_types`, no `specifications`,
 * no source-catalogue labels, no hero collections.
 *
 * Idempotent by construction. A part that is already linked is reported as
 * `alreadyLinked` rather than raising an error that would abort the batch, and
 * the unique index from migration 0026 is the race-safe backstop if two admins
 * submit the same link simultaneously.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);

  const outcome = await performCompatibilityMutation(
    "link",
    body,
    access.session.user.id,
    createCompatibilityMutationDeps(),
  );

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  const { result } = outcome;

  /* 200 even when the Typesense sync failed, because the database change IS
     committed and is the authority. A 5xx here would tell the admin the link
     did not happen, which would be false. The failure is in the payload and in
     the audit trail, and search still answers from Postgres meanwhile. */
  return NextResponse.json(
    {
      result,
      message: `Linked ${result.linked}, already linked ${result.alreadyLinked}, failed ${result.failed}.`,
      syncWarning: result.sync.ok
        ? null
        : `Saved in the database, but the search index could not be updated: ${result.sync.error}`,
    },
    { status: 200 },
  );
}
