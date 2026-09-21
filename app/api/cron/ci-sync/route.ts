import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createDbSyncStore, recordSyncRun } from "@/lib/ci-sync/db-store";
import { createCiHttpFetcher } from "@/lib/ci-sync/http-fetcher";
import { runCiSync } from "@/lib/ci-sync/run";
import { CI_SOURCE_KEY } from "@/lib/ci-sync/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron entrypoint. Requires Authorization: Bearer ${CRON_SECRET}.
 * Always refuses writes when CRON_SECRET is unset (safe default).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing scheduled sync" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const startedAt = new Date();
  const runId = randomUUID();

  try {
    const result = await runCiSync({
      sourceKey: CI_SOURCE_KEY,
      dryRun,
      fetcher: createCiHttpFetcher({
        authHeader: process.env.CI_SOURCE_AUTH_HEADER || null,
      }),
      store: dryRun ? undefined : createDbSyncStore(),
    });

    await recordSyncRun({
      id: runId,
      sourceKey: CI_SOURCE_KEY,
      status: result.status,
      dryRun,
      fetchComplete: result.fetchComplete,
      fetchedCount: result.fetchedCount,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
      unchangedCount: result.unchangedCount,
      sourceRemovedCount: result.sourceRemovedCount,
      approvalPendingCount: result.approvalPendingCount,
      failedCount: result.failedCount,
      errorSummary: result.errorSummary,
      startedAt,
      finishedAt: new Date(),
      triggeredBy: "cron",
    }).catch(() => undefined);

    return NextResponse.json({ runId, ...result, diffs: undefined });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scheduled CI sync failed" },
      { status: 500 },
    );
  }
}
