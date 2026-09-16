import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { part, wishlist } from "@/drizzle/schema";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const items = await db
    .select({
      id: wishlist.id,
      partId: wishlist.partId,
      partNumber: part.partNumber,
      partName: part.name,
      brand: part.brand,
      createdAt: wishlist.createdAt,
    })
    .from(wishlist)
    .innerJoin(part, eq(wishlist.partId, part.id))
    .where(eq(wishlist.userId, session.user.id))
    .orderBy(desc(wishlist.createdAt));

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const partId = typeof body?.partId === "string" ? body.partId.trim() : "";
  if (!partId) {
    return NextResponse.json({ error: "partId is required" }, { status: 400 });
  }

  const db = getDb();
  const existingPart = await db.query.part.findFirst({
    where: eq(part.id, partId),
  });
  if (!existingPart) {
    return NextResponse.json({ error: "Part not found" }, { status: 404 });
  }

  const existing = await db.query.wishlist.findFirst({
    where: and(
      eq(wishlist.userId, session.user.id),
      eq(wishlist.partId, partId),
    ),
  });
  if (existing) {
    return NextResponse.json({ success: true, id: existing.id });
  }

  const id = randomUUID();
  await db.insert(wishlist).values({
    id,
    userId: session.user.id,
    partId,
  });

  return NextResponse.json({ success: true, id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const partId = typeof body?.partId === "string" ? body.partId.trim() : "";

  if (!id && !partId) {
    return NextResponse.json(
      { error: "id or partId is required" },
      { status: 400 },
    );
  }

  const db = getDb();

  if (id) {
    const existing = await db.query.wishlist.findFirst({
      where: and(eq(wishlist.id, id), eq(wishlist.userId, session.user.id)),
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    await db.delete(wishlist).where(eq(wishlist.id, id));
  } else {
    await db
      .delete(wishlist)
      .where(
        and(
          eq(wishlist.userId, session.user.id),
          eq(wishlist.partId, partId),
        ),
      );
  }

  return NextResponse.json({ success: true });
}
