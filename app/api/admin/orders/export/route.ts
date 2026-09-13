import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { getDb } from "@/lib/db";
import { order, user, orderItem } from "@/drizzle/schema";
import { desc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await getServerSession();

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  try {
    const ordersData = await db
      .select({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerEmail: user.email,
        buyerPhone: user.phoneNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subtotalPaise: order.subtotalPaise,
        shippingPaise: order.shippingPaise,
        totalPaise: order.totalPaise,
        shippingName: order.shippingName,
        shippingPhone: order.shippingPhone,
        shippingAddressLine1: order.shippingAddressLine1,
        shippingAddressLine2: order.shippingAddressLine2,
        shippingCity: order.shippingCity,
        shippingState: order.shippingState,
        shippingPincode: order.shippingPincode,
        createdAt: order.createdAt,
      })
      .from(order)
      .innerJoin(user, eq(order.buyerId, user.id))
      .orderBy(desc(order.createdAt));

    const rows = ordersData.map((o) => {
      const gstAmount = Math.max(
        0,
        o.totalPaise - o.subtotalPaise - (o.shippingPaise || 0),
      );

      let buyerGstin = "-";
      if (o.shippingAddressLine2?.includes("GSTIN:")) {
        const match = o.shippingAddressLine2.match(/GSTIN:\s*([0-9A-Z]{15})/i);
        if (match) buyerGstin = match[1].toUpperCase();
      }

      return {
        "Order Number": o.orderNumber,
        Date: new Date(o.createdAt).toISOString().split("T")[0],
        Customer: o.shippingName,
        "Customer Email": o.buyerEmail,
        "Customer Phone": o.shippingPhone,
        "Buyer GSTIN": buyerGstin,
        City: o.shippingCity,
        State: o.shippingState,
        Pincode: o.shippingPincode,
        "Subtotal (₹)": (o.subtotalPaise / 100).toFixed(2),
        "GST (₹)": (gstAmount / 100).toFixed(2),
        "Shipping (₹)": ((o.shippingPaise || 0) / 100).toFixed(2),
        "Total (₹)": (o.totalPaise / 100).toFixed(2),
        "Payment Method": o.paymentMethod.replace(/_/g, " "),
        "Payment Status": o.paymentStatus,
        "Order Status": o.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sparelink_orders_${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Orders export error:", error);
    return NextResponse.json(
      { error: "Failed to export orders" },
      { status: 500 },
    );
  }
}
