import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { pricingCategory } from "@/drizzle/schema";
import { writeAuditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { requireAdminApi } from "@/lib/require-role";

export async function GET() {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const rows = await getDb()
    .select()
    .from(pricingCategory)
    .orderBy(desc(pricingCategory.createdAt))
    .limit(200);
  return NextResponse.json({ categories: rows });
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const code =
    typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!code || !name) {
    return NextResponse.json(
      { error: "code and name are required" },
      { status: 400 },
    );
  }

  const id = randomUUID();
  await getDb()
    .insert(pricingCategory)
    .values({
      id,
      code,
      name,
      description:
        typeof body.description === "string"
          ? body.description.trim() || null
          : null,
      isActive: body.isActive === false ? false : true,
    });

  await writeAuditLog({
    actorUserId: access.session.user.id,
    action: "pricing_category.create",
    entityType: "pricing_category",
    entityId: id,
    metadata: { code, name },
  });

  return NextResponse.json({ id, code, name }, { status: 201 });
}
