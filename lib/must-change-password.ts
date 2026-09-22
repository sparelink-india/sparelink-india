import { eq } from "drizzle-orm";

import { verification } from "@/drizzle/schema";
import { getDb } from "@/lib/db";

const PREFIX = "must-change-password:";
const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");

export function mustChangeIdentifier(userId: string): string {
  return `${PREFIX}${userId}`;
}

export async function isMustChangePassword(userId: string): Promise<boolean> {
  const row = await getDb().query.verification.findFirst({
    where: eq(verification.identifier, mustChangeIdentifier(userId)),
  });
  if (!row) return false;
  return row.expiresAt > new Date() && row.value === "required";
}

export async function setMustChangePassword(userId: string, required: boolean): Promise<void> {
  const db = getDb();
  const identifier = mustChangeIdentifier(userId);
  await db.delete(verification).where(eq(verification.identifier, identifier));
  if (!required) return;
  await db.insert(verification).values({
    id: `verify-${identifier}`,
    identifier,
    value: "required",
    expiresAt: FAR_FUTURE,
  });
}

export async function clearMustChangePassword(userId: string): Promise<void> {
  await setMustChangePassword(userId, false);
}
