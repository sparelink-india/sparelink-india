import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { catalogueSyncRun } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { countSourceQueues, createDbSyncStore, recordSyncRun } from "@/lib/ci-sync/db-store";
import { createCiHttpFetcher } from "@/lib/ci-sync/http-fetcher";
import { fixtureFetcherFromRaw, runCiSync } from "@/lib/ci-sync/run";
import { CI_SOURCE_KEY } from "@/lib/ci-sync/types";
import { requireAdminApi } from "@/lib/require-role";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function executeSync(input: {
  dryRun: boolean;
  useFixture: boolean;
  triggeredBy: string;
}) {
  const startedAt = new Date();
  const runId = randomUUID();

  const fetcher = input.useFixture
    ? fixtureFetcherFromRaw([
        {
          id: "fixture-1",
          sku: "FIXTURE-CI-001",
          name: "FIXTURE DOOR HANDLE LEFT",
          manufacturer: "CI AUTOMOTIVE LLP",
          brand: "CI AUTOMOTIVE LLP",
          rate: 488,
          imageUrl: null,
          oeCode: null,
          statusSource: "Live",
          category: "Body Parts",
        },
      ])
    : createCiHttpFetcher({
        authHeader: process.env.CI_SOURCE_AUTH_HEADER || null,
      });

  const result = await runCiSync({
    sourceKey: CI_SOURCE_KEY,
    dryRun: input.dryRun,
    fetcher,
    store: input.dryRun ? undefined : createDbSyncStore(),
  });

  const finishedAt = new Date();
  try {
    await recordSyncRun({
      id: runId,
      sourceKey: CI_SOURCE_KEY,
      status: result.status,
      dryRun: input.dryRun,
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
      finishedAt,
      triggeredBy: input.triggeredBy,
    });
  } catch {
    // Logging failure must not hide sync outcome from the caller.
  }

  return { runId, ...result, diffs: undefined };
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  try {
    const db = getDb();
    const queues = await countSourceQueues();
    const recent = await db
      .select({
        id: catalogueSyncRun.id,
        status: catalogueSyncRun.status,
        dryRun: catalogueSyncRun.dryRun,
        fetchComplete: catalogueSyncRun.fetchComplete,
        fetchedCount: catalogueSyncRun.fetchedCount,
        newCount: catalogueSyncRun.newCount,
        updatedCount: catalogueSyncRun.updatedCount,
        unchangedCount: catalogueSyncRun.unchangedCount,
        sourceRemovedCount: catalogueSyncRun.sourceRemovedCount,
        approvalPendingCount: catalogueSyncRun.approvalPendingCount,
        failedCount: catalogueSyncRun.failedCount,
        errorSummary: catalogueSyncRun.errorSummary,
        startedAt: catalogueSyncRun.startedAt,
        finishedAt: catalogueSyncRun.finishedAt,
        triggeredBy: catalogueSyncRun.triggeredBy,
      })
      .from(catalogueSyncRun)
      .where(eq(catalogueSyncRun.sourceKey, CI_SOURCE_KEY))
      .orderBy(desc(catalogueSyncRun.startedAt))
      .limit(20);

    return NextResponse.json({
      sourceKey: CI_SOURCE_KEY,
      queues,
      recentRuns: recent,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load CI sync status",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  let body: { dryRun?: boolean; useFixture?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const dryRun = body.dryRun !== false ? true : false;
  // Default dry-run=true for safety. Explicit dryRun:false required for writes.
  const useFixture = body.useFixture === true;

  try {
    const result = await executeSync({
      dryRun,
      useFixture,
      triggeredBy: `admin:${auth.session.user.id}`,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CI sync failed" },
      { status: 500 },
    );
  }
}
