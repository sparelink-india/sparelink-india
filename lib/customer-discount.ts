import { eq, like } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { verification } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import {
  clampDiscountPercent,
  resolveEffectiveDiscountPercent,
} from "@/lib/party-pricing";

const COMMON_IDENTIFIER = "pricing:common-customer-discount";
const CUSTOMER_PREFIX = "pricing:customer-discount:";
const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");

export type StorefrontPricingContext = {
  commonCustomerDiscountPercent: number;
  customerDiscountPercent: number | null;
  effectiveDiscountPercent: number;
  source: "specific" | "common";
};

function customerIdentifier(userId: string): string {
  return `${CUSTOMER_PREFIX}${userId}`;
}

function parseStoredPercent(value: string | undefined): number | null {
  if (value === undefined) return null;
  const numeric = Number(value);
  return clampDiscountPercent(numeric);
}

async function readVerification(identifier: string): Promise<string | undefined> {
  const row = await getDb().query.verification.findFirst({
    where: eq(verification.identifier, identifier),
  });
  if (!row || row.expiresAt <= new Date()) return undefined;
  return row.value;
}

async function writeVerification(identifier: string, value: string | null): Promise<void> {
  const db = getDb();
  await db.delete(verification).where(eq(verification.identifier, identifier));
  if (value === null) return;
  await db.insert(verification).values({
    id: `verify-${identifier}-${randomUUID().slice(0, 8)}`,
    identifier,
    value,
    expiresAt: FAR_FUTURE,
  });
}

export async function getCommonCustomerDiscountPercent(): Promise<number> {
  const stored = parseStoredPercent(await readVerification(COMMON_IDENTIFIER));
  return stored ?? 0;
}

export async function setCommonCustomerDiscountPercent(percent: number): Promise<number> {
  const clamped = clampDiscountPercent(percent);
  if (clamped === null) {
    throw new Error("Discount must be an integer from 0 to 100.");
  }
  await writeVerification(COMMON_IDENTIFIER, String(clamped));
  return clamped;
}

export async function getCustomerDiscountPercent(userId: string): Promise<number | null> {
  return parseStoredPercent(await readVerification(customerIdentifier(userId)));
}

export async function setCustomerDiscountPercent(
  userId: string,
  percent: number | null,
): Promise<number | null> {
  if (percent === null) {
    await writeVerification(customerIdentifier(userId), null);
    return null;
  }
  const clamped = clampDiscountPercent(percent);
  if (clamped === null) {
    throw new Error("Discount must be an integer from 0 to 100.");
  }
  await writeVerification(customerIdentifier(userId), String(clamped));
  return clamped;
}

export async function getCustomerDiscountMap(
  userIds: string[],
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  for (const id of userIds) map.set(id, null);
  if (userIds.length === 0) return map;

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
    map.set(userId, parseStoredPercent(row.value));
  }
  return map;
}

export async function resolveStorefrontPricing(
  session: { user: { id: string; role?: string | null } } | null,
): Promise<StorefrontPricingContext> {
  const commonCustomerDiscountPercent = await getCommonCustomerDiscountPercent();
  if (session?.user?.role === "buyer") {
    const customerDiscountPercent = await getCustomerDiscountPercent(session.user.id);
    const resolved = resolveEffectiveDiscountPercent(
      commonCustomerDiscountPercent,
      customerDiscountPercent,
    );
    return {
      commonCustomerDiscountPercent,
      customerDiscountPercent,
      ...resolved,
    };
  }

  return {
    commonCustomerDiscountPercent,
    customerDiscountPercent: null,
    effectiveDiscountPercent: commonCustomerDiscountPercent,
    source: "common",
  };
}
