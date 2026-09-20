import { eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { verification } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import {
  emptyPensolConfig,
  normalizePensolConfig,
  type PensolDiscountConfig,
} from "@/lib/pensol-pricing";

const COMMON_IDENTIFIER = "pricing:pensol:common";
const CUSTOMER_PREFIX = "pricing:pensol:customer:";
const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");

function customerIdentifier(userId: string): string {
  return `${CUSTOMER_PREFIX}${userId}`;
}

async function readJson(identifier: string): Promise<PensolDiscountConfig> {
  const row = await getDb().query.verification.findFirst({
    where: eq(verification.identifier, identifier),
  });
  if (!row || row.expiresAt <= new Date()) return emptyPensolConfig();
  try {
    return normalizePensolConfig(JSON.parse(row.value));
  } catch {
    return emptyPensolConfig();
  }
}

async function writeJson(identifier: string, config: PensolDiscountConfig | null): Promise<void> {
  const db = getDb();
  await db.delete(verification).where(eq(verification.identifier, identifier));
  if (!config) return;
  const empty =
    !config.oil && !config.grease && Object.keys(config.sku).length === 0;
  if (empty) return;
  await db.insert(verification).values({
    id: `verify-${identifier}-${randomUUID().slice(0, 8)}`,
    identifier,
    value: JSON.stringify(config),
    expiresAt: FAR_FUTURE,
  });
}

export async function getCommonPensolConfig(): Promise<PensolDiscountConfig> {
  return readJson(COMMON_IDENTIFIER);
}

export async function setCommonPensolConfig(
  config: PensolDiscountConfig,
): Promise<PensolDiscountConfig> {
  const normalized = normalizePensolConfig(config);
  await writeJson(COMMON_IDENTIFIER, normalized);
  return normalized;
}

export async function getCustomerPensolConfig(
  userId: string,
): Promise<PensolDiscountConfig> {
  return readJson(customerIdentifier(userId));
}

export async function setCustomerPensolConfig(
  userId: string,
  config: PensolDiscountConfig | null,
): Promise<PensolDiscountConfig> {
  if (config === null) {
    await writeJson(customerIdentifier(userId), null);
    return emptyPensolConfig();
  }
  const normalized = normalizePensolConfig(config);
  await writeJson(customerIdentifier(userId), normalized);
  return normalized;
}

export async function getCustomerPensolConfigMap(
  userIds: string[],
): Promise<Map<string, PensolDiscountConfig>> {
  const map = new Map<string, PensolDiscountConfig>();
  for (const id of userIds) map.set(id, emptyPensolConfig());
  if (!userIds.length) return map;
  const rows = await getDb()
    .select({
      identifier: verification.identifier,
      value: verification.value,
      expiresAt: verification.expiresAt,
    })
    .from(verification)
    .where(like(verification.identifier, `${CUSTOMER_PREFIX}%`));
  const now = new Date();
  for (const row of rows) {
    if (row.expiresAt <= now) continue;
    const userId = row.identifier.slice(CUSTOMER_PREFIX.length);
    if (!map.has(userId)) continue;
    try {
      map.set(userId, normalizePensolConfig(JSON.parse(row.value)));
    } catch {
      map.set(userId, emptyPensolConfig());
    }
  }
  return map;
}

export async function resolvePensolConfigsForUser(userId: string | null): Promise<{
  commonConfig: PensolDiscountConfig;
  customerConfig: PensolDiscountConfig | null;
}> {
  const commonConfig = await getCommonPensolConfig();
  if (!userId) return { commonConfig, customerConfig: null };
  return {
    commonConfig,
    customerConfig: await getCustomerPensolConfig(userId),
  };
}
