import PDFDocument from "pdfkit";
import { extractGSTRate } from "@/lib/gst";
import { splitInclusiveGst } from "@/lib/party-pricing";

export type InvoicePDFData = {
  orderNumber: string;
  createdAt: Date;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingMethod?: string | null;
  transportName?: string | null;
  transportPhone?: string | null;
  transportGstin?: string | null;
  items: Array<{
    partNumber: string;
    partName: string;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
    partDescription?: string | null;
  }>;
  allocations: Array<{
    allocationNumber: string;
    firmName: string;
    firmCode: string;
    accountingReference?: string | null;
  }>;
};

export async function generateInvoicePDFBuffer(
  data: InvoicePDFData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
        info: {
          Title: `SpareLink Tax Invoice - ${data.orderNumber}`,
          Author: "SpareLink India",
          Subject: `Tax Invoice for Order ${data.orderNumber}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Header Brand
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#0f172a").text("SpareLink India");
      doc.fontSize(9).font("Helvetica").fillColor("#64748b").text("Automotive Spare Parts Marketplace & Logistics");
      doc.moveDown(0.5);

      // Invoice Title & Meta (Right side / Next block)
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#0f172a").text("TAX INVOICE", { align: "right" });
      doc.fontSize(9).font("Helvetica").fillColor("#334155");
      doc.text(`Invoice / Order #: ${data.orderNumber}`, { align: "right" });
      doc.text(
        `Date: ${new Date(data.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`,
        { align: "right" },
      );
      doc.text(`Payment Method: ${data.paymentMethod.replace(/_/g, " ").toUpperCase()} (${data.paymentStatus.toUpperCase()})`, { align: "right" });

      doc.moveDown(1);
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);

      // Supplier & Consignee Columns
      const startY = doc.y;
      
      // Left Column: Supplier / Fulfillment
      const primaryFirm = data.allocations[0]?.firmName || "Ambaji Traders";
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("Fulfillment Supplier:", 40, startY);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#334155").text(primaryFirm);
      doc.font("Helvetica").fillColor("#475569");
      doc.text("Regional Automotive Parts Distribution Center");
      doc.text("GSTIN: 24AAACA0000A1Z5 (Authorized Supplier)");
      doc.text("State: Gujarat / India (State Code: 24)");

      // Right Column: Consignee / Buyer
      let buyerGstin = "B2C / Unregistered";
      if (data.shippingAddressLine2?.includes("GSTIN:")) {
        const match = data.shippingAddressLine2.match(/GSTIN:\s*([0-9A-Z]{15})/i);
        if (match) buyerGstin = match[1].toUpperCase();
      }

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("Billed & Delivered To:", 310, startY);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#334155").text(data.shippingName, 310);
      doc.font("Helvetica").fillColor("#475569");
      doc.text(data.shippingAddressLine1, 310);
      if (data.shippingAddressLine2) {
        doc.text(data.shippingAddressLine2, 310);
      }
      doc.text(`${data.shippingCity}, ${data.shippingState} - ${data.shippingPincode}`, 310);
      doc.text(`Phone: ${data.shippingPhone}`, 310);
      doc.text(`Buyer GSTIN: ${buyerGstin}`, 310);

      doc.moveDown(2);
      const tableTop = Math.max(doc.y, startY + 110);

      // Line Items Table Header
      doc.rect(40, tableTop, 515, 20).fill("#f1f5f9");
      doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(8);
      doc.text("#", 45, tableTop + 6, { width: 20 });
      doc.text("PART NO / DESCRIPTION", 70, tableTop + 6, { width: 170 });
      doc.text("HSN", 245, tableTop + 6, { width: 50, align: "center" });
      doc.text("QTY", 300, tableTop + 6, { width: 30, align: "center" });
      doc.text("RATE (INR)", 335, tableTop + 6, { width: 55, align: "right" });
      doc.text("TAXABLE", 395, tableTop + 6, { width: 55, align: "right" });
      doc.text("GST", 455, tableTop + 6, { width: 35, align: "center" });
      doc.text("TOTAL (INR)", 495, tableTop + 6, { width: 55, align: "right" });

      let currentY = tableTop + 24;
      doc.font("Helvetica").fontSize(8).fillColor("#0f172a");

      let totalCalculatedTaxPaise = 0;

      data.items.forEach((item, index) => {
        const gstRate = extractGSTRate(item.partDescription);
        const inclusiveTotal = item.totalPaise;
        const tax = splitInclusiveGst(inclusiveTotal, gstRate);
        totalCalculatedTaxPaise += tax.gstPaise;

        let hsn = "87089900";
        if (item.partDescription?.includes("HSN:")) {
          const match = item.partDescription.match(/HSN:\s*(\d+)/i);
          if (match) hsn = match[1];
        }

        // Draw row
        doc.text(String(index + 1), 45, currentY, { width: 20 });
        doc.font("Helvetica-Bold").text(`${item.partName}`, 70, currentY, { width: 170 });
        doc.font("Helvetica").fillColor("#64748b").text(`Part #${item.partNumber}`, 70, currentY + 10, { width: 170 });
        doc.fillColor("#0f172a");

        doc.text(hsn, 245, currentY, { width: 50, align: "center" });
        doc.text(String(item.quantity), 300, currentY, { width: 30, align: "center" });
        doc.text((tax.basePaise / Math.max(item.quantity, 1) / 100).toFixed(2), 335, currentY, { width: 55, align: "right" });
        doc.text((tax.basePaise / 100).toFixed(2), 395, currentY, { width: 55, align: "right" });
        doc.text(`${gstRate}%`, 455, currentY, { width: 35, align: "center" });
        doc.font("Helvetica-Bold").text((inclusiveTotal / 100).toFixed(2), 495, currentY, { width: 55, align: "right" });
        doc.font("Helvetica");

        currentY += 24;
        doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(40, currentY - 4).lineTo(555, currentY - 4).stroke();
      });

      doc.moveDown(1);
      currentY += 10;

      // Allocation Snapshot (Left) & Totals (Right)
      doc.rect(40, currentY, 260, 65).fill("#f8fafc").strokeColor("#e2e8f0").stroke();
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8).text("REGIONAL ALLOCATION & LOGISTICS", 50, currentY + 8);
      doc.font("Helvetica").fontSize(7.5).fillColor("#475569");
      doc.text(`Order Status: ${data.status.toUpperCase()}`, 50, currentY + 20);

      const modeStr = data.shippingMethod === "self_pickup"
        ? "Self Pickup"
        : data.shippingMethod === "transport"
          ? `Transport (${data.transportName || "Booked Transport"})`
          : "Standard Courier Dispatch";
      doc.text(`Logistics: ${modeStr}`, 50, currentY + 31);

      if (data.allocations.length > 0) {
        doc.text(`Alloc: ${data.allocations[0].allocationNumber} (${data.allocations[0].firmName})`, 50, currentY + 42);
      } else {
        doc.text(`Fulfillment: Direct Dispatch (${primaryFirm})`, 50, currentY + 42);
      }

      // Totals Table (Right)
      const totalsLeft = 320;
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155");
      doc.text("Taxable Subtotal:", totalsLeft, currentY + 8);
      doc.text(`INR ${(data.subtotalPaise / 100).toFixed(2)}`, 450, currentY + 8, { width: 100, align: "right" });

      doc.text("Total Itemized GST:", totalsLeft, currentY + 22);
      doc.text(`INR ${(totalCalculatedTaxPaise / 100).toFixed(2)}`, 450, currentY + 22, { width: 100, align: "right" });

      doc.text("Shipping & Freight:", totalsLeft, currentY + 36);
      doc.text(data.shippingPaise === 0 ? "INR 0.00 (Free)" : `INR ${(data.shippingPaise / 100).toFixed(2)}`, 450, currentY + 36, { width: 100, align: "right" });

      doc.strokeColor("#0f172a").lineWidth(1).moveTo(totalsLeft, currentY + 50).lineTo(555, currentY + 50).stroke();

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a");
      doc.text("Grand Total:", totalsLeft, currentY + 54);
      doc.text(`INR ${(data.totalPaise / 100).toFixed(2)}`, 450, currentY + 54, { width: 100, align: "right" });

      // Footer
      doc.fontSize(7.5).font("Helvetica").fillColor("#94a3b8");
      doc.text(
        "This is a computer-generated tax invoice issued by SpareLink India and does not require a physical signature.",
        40,
        740,
        { align: "center", width: 515 },
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
