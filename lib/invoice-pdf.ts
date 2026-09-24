import PDFDocument from "pdfkit";
import type { FirmSellerProfile } from "@/lib/firms";

export type InvoiceLineSnapshot = {
  partNumber: string;
  partName: string;
  quantity: number;
  unitPricePaise: number;
  /** Inclusive line total (historical snapshot). */
  totalPaise: number;
  gstRate: number;
  /** Taxable line base (historical snapshot). */
  lineBasePaise: number;
  /** Line GST amount (historical snapshot). */
  lineGstPaise: number;
  hsn?: string | null;
};

export type InvoicePDFData = {
  orderNumber: string;
  invoiceReference: string;
  createdAt: Date;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  /** Taxable merchandise subtotal for this firm invoice. */
  subtotalPaise: number;
  /** GST total for this firm invoice (from snapshots). */
  gstPaise: number;
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
  buyerGstin?: string | null;
  seller: FirmSellerProfile;
  items: InvoiceLineSnapshot[];
  allocation: {
    allocationNumber: string;
    firmName: string;
    firmCode: string;
    accountingReference?: string | null;
  };
};

function formatInr(paise: number): string {
  return `INR ${(paise / 100).toFixed(2)}`;
}

export async function generateInvoicePDFBuffer(
  data: InvoicePDFData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
        info: {
          Title: `Tax Invoice - ${data.invoiceReference}`,
          Author: data.seller.legalName,
          Subject: `Tax Invoice for ${data.invoiceReference}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text(data.seller.legalName);
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#64748b")
        .text(`Fulfilled via SpareLink India · Firm code ${data.seller.firmCode}`);
      doc.moveDown(0.5);

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("TAX INVOICE", { align: "right" });
      doc.fontSize(9).font("Helvetica").fillColor("#334155");
      doc.text(`Invoice #: ${data.invoiceReference}`, { align: "right" });
      doc.text(`Parent order #: ${data.orderNumber}`, { align: "right" });
      doc.text(
        `Date: ${new Date(data.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`,
        { align: "right" },
      );
      doc.text(
        `Payment Method: ${data.paymentMethod.replace(/_/g, " ").toUpperCase()} (${data.paymentStatus.toUpperCase()})`,
        { align: "right" },
      );

      doc.moveDown(1);
      doc
        .strokeColor("#cbd5e1")
        .lineWidth(1)
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke();
      doc.moveDown(1);

      const startY = doc.y;

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("Seller:", 40, startY);
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#334155")
        .text(data.seller.legalName);
      doc.font("Helvetica").fillColor("#475569");
      if (data.seller.address) {
        doc.text(data.seller.address);
      }
      if (data.seller.phone) {
        doc.text(`Phone: ${data.seller.phone}`);
      }
      if (data.seller.email) {
        doc.text(`Email: ${data.seller.email}`);
      }
      doc.text(
        data.seller.gstin
          ? `GSTIN: ${data.seller.gstin}`
          : "GSTIN: Not on file for this firm",
      );

      let buyerGstin = data.buyerGstin?.trim().toUpperCase() || "";
      if (!buyerGstin && data.shippingAddressLine2?.includes("GSTIN:")) {
        const match = data.shippingAddressLine2.match(
          /GSTIN:\s*([0-9A-Z]{15})/i,
        );
        if (match) buyerGstin = match[1].toUpperCase();
      }
      if (!buyerGstin) buyerGstin = "B2C / Unregistered";

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#0f172a")
        .text("Billed & Delivered To:", 310, startY);
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#334155")
        .text(data.shippingName, 310);
      doc.font("Helvetica").fillColor("#475569");
      doc.text(data.shippingAddressLine1, 310);
      if (data.shippingAddressLine2) {
        doc.text(data.shippingAddressLine2, 310);
      }
      doc.text(
        `${data.shippingCity}, ${data.shippingState} - ${data.shippingPincode}`,
        310,
      );
      doc.text(`Phone: ${data.shippingPhone}`, 310);
      doc.text(`Buyer GSTIN: ${buyerGstin}`, 310);

      doc.moveDown(2);
      const tableTop = Math.max(doc.y, startY + 110);

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

      data.items.forEach((item, index) => {
        const unitTaxablePaise =
          item.quantity > 0
            ? Math.round(item.lineBasePaise / item.quantity)
            : item.lineBasePaise;
        const hsn = item.hsn?.trim() || "—";

        doc.text(String(index + 1), 45, currentY, { width: 20 });
        doc
          .font("Helvetica-Bold")
          .text(`${item.partName}`, 70, currentY, { width: 170 });
        doc
          .font("Helvetica")
          .fillColor("#64748b")
          .text(`Part #${item.partNumber}`, 70, currentY + 10, { width: 170 });
        doc.fillColor("#0f172a");

        doc.text(hsn, 245, currentY, { width: 50, align: "center" });
        doc.text(String(item.quantity), 300, currentY, {
          width: 30,
          align: "center",
        });
        doc.text((unitTaxablePaise / 100).toFixed(2), 335, currentY, {
          width: 55,
          align: "right",
        });
        doc.text((item.lineBasePaise / 100).toFixed(2), 395, currentY, {
          width: 55,
          align: "right",
        });
        doc.text(`${item.gstRate}%`, 455, currentY, {
          width: 35,
          align: "center",
        });
        doc
          .font("Helvetica-Bold")
          .text((item.totalPaise / 100).toFixed(2), 495, currentY, {
            width: 55,
            align: "right",
          });
        doc.font("Helvetica");

        currentY += 24;
        doc
          .strokeColor("#f1f5f9")
          .lineWidth(0.5)
          .moveTo(40, currentY - 4)
          .lineTo(555, currentY - 4)
          .stroke();
      });

      doc.moveDown(1);
      currentY += 10;

      doc
        .rect(40, currentY, 260, 65)
        .fill("#f8fafc")
        .strokeColor("#e2e8f0")
        .stroke();
      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("FIRM ALLOCATION", 50, currentY + 8);
      doc.font("Helvetica").fontSize(7.5).fillColor("#475569");
      doc.text(`Order Status: ${data.status.toUpperCase()}`, 50, currentY + 20);

      const modeStr =
        data.shippingMethod === "self_pickup"
          ? "Self Pickup"
          : data.shippingMethod === "transport"
            ? `Transport (${data.transportName || "Booked Transport"})`
            : "Standard Courier Dispatch";
      doc.text(`Logistics: ${modeStr}`, 50, currentY + 31);
      doc.text(
        `Alloc: ${data.allocation.allocationNumber} (${data.allocation.firmName})`,
        50,
        currentY + 42,
      );

      const totalsLeft = 320;
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155");
      doc.text("Taxable Subtotal:", totalsLeft, currentY + 8);
      doc.text(formatInr(data.subtotalPaise), 450, currentY + 8, {
        width: 100,
        align: "right",
      });

      doc.text("Total Itemized GST:", totalsLeft, currentY + 22);
      doc.text(formatInr(data.gstPaise), 450, currentY + 22, {
        width: 100,
        align: "right",
      });

      doc.text("Shipping & Freight:", totalsLeft, currentY + 36);
      doc.text(
        data.shippingPaise === 0
          ? "INR 0.00 (Free)"
          : formatInr(data.shippingPaise),
        450,
        currentY + 36,
        { width: 100, align: "right" },
      );

      doc
        .strokeColor("#0f172a")
        .lineWidth(1)
        .moveTo(totalsLeft, currentY + 50)
        .lineTo(555, currentY + 50)
        .stroke();

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a");
      doc.text("Grand Total:", totalsLeft, currentY + 54);
      doc.text(formatInr(data.totalPaise), 450, currentY + 54, {
        width: 100,
        align: "right",
      });

      doc.fontSize(7.5).font("Helvetica").fillColor("#94a3b8");
      doc.text(
        `Computer-generated tax invoice issued by ${data.seller.legalName}. Physical signature not required.`,
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
