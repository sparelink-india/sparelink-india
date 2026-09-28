import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/require-role";
import { createCompatibilityMutationDeps } from "@/lib/vehicle-compatibility-repository";
import { performCompatibilityMutation } from "@/lib/vehicle-compatibility-service";

/**
 * POST /api/admin/vehicle-compatibility/unlink
 *
 * Removes links for ONE vehicle and the selected products. It can never touch
 * another vehicle's compatibility: the delete is scoped by an equality on
 * `vehicle_id` and an `IN` list on `part_id`, never two `IN` lists.
 *
 * A part that is not linked is reported as `alreadyUnlinked` rather than
 * failing, so retrying is safe.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);

  const outcome = await performCompatibilityMutation(
    "unlink",
    body,
    access.session.user.id,
    createCompatibilityMutationDeps(),
  );

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  const { result } = outcome;

  return NextResponse.json(
    {
      result,
      message: `Unlinked ${result.unlinked}, already unlinked ${result.alreadyUnlinked}, failed ${result.failed}.`,
      syncWarning: result.sync.ok
        ? null
        : `Saved in the database, but the search index could not be updated: ${result.sync.error}`,
    },
    { status: 200 },
  );
}
