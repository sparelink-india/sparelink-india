import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { auditLog } from "@/drizzle/schema";

export async function writeAuditLog(params: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      id: randomUUID(),
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}

export function generateTicketNumber(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}
