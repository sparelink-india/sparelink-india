const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const PDF_PATH = path.join(
  "catalogue-source",
  "MEKO",
  "MEKO Genuine Spares 36-page.pdf",
);
const OUT_DIR = path.join("catalogue-source", "MEKO");
const EXTRACT_JSON = path.join(OUT_DIR, "extracted.json");
const EXTRACT_CSV = path.join(OUT_DIR, "extracted.csv");
const TEXT_PATH = path.join(OUT_DIR, "extracted-text.txt");
const SUMMARY_PATH = path.join(OUT_DIR, "extraction-summary.json");

function loadPdfParse() {
  try {
    return require("pdf-parse");
  } catch {
    const nested = path.join("node_modules", "pdf-parse", "package.json");
    if (fs.existsSync(nested)) {
      return createRequire(path.resolve(nested))("pdf-parse");
    }
    throw new Error("pdf-parse is not available");
  }
}

function parsePages(rawText) {
  const pages = String(rawText || "")
    .split(/\f/)
    .map((page) => page.replace(/\r/g, "").trimEnd());
  return pages.length ? pages : [String(rawText || "")];
}

function extractMCodes(text) {
  const matches = String(text || "").match(/\bM[-\s]\d+[A-Z]?(?:\s*\/\s*M[-\s]\d+[A-Z]?)*/g) || [];
  return [...new Set(matches.map((value) => value.replace(/\s+/g, " ").trim()))];
}

function isNoise(line) {
  return (
    /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line) ||
    /^ASSEMBLIES WATER PUMP$/i.test(line) ||
    /^WATER PUMP/i.test(line) ||
    /^MEKO/i.test(line) ||
    /^\( GST/i.test(line) ||
    /^MRP\b/i.test(line) ||
    /^Detail$/i.test(line) ||
    /^\d+\.?$/.test(line) ||
    /^\d{3,5}$/.test(line)
  );
}

function parsePartNumberLine(line) {
  const cleaned = line.replace(/\s+MRP.*$/i, "").trim();
  const match = cleaned.match(
    /^(M[-\s]\d+[A-Z]?(?:\s*\/\s*M[-\s]\d+[A-Z]?)*)(?:\s+([A-Z]))?$/i,
  );
  if (!match) return null;
  const suffix = match[2] ? ` ${match[2]}` : "";
  return `${match[1].replace(/\s+/g, " ").trim()}${suffix}`;
}

function emptyRef(value) {
  return !value || /^[\s./]+$/.test(value) || /^[.\s]+$/.test(value);
}

function extractProducts(pages) {
  const products = [];
  const seen = new Set();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageNo = pageIndex + 1;
    const lines = pages[pageIndex]
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    let pendingApp = [];
    let pendingRef = "";
    let lastProduct = null;

    const flushApp = () => pendingApp.join(" ").replace(/\s+/g, " ").trim();

    for (const line of lines) {
      if (isNoise(line)) continue;
      if (/ASSEMBLIES WATER PUMP/i.test(line)) continue;

      const refMatch = line.match(/^REF\.?\s*NO\.?:?\s*(.*)$/i);
      if (refMatch) {
        const ref = refMatch[1].replace(/\s+/g, " ").trim();
        if (!emptyRef(ref)) {
          if (lastProduct && !lastProduct.referenceNo) lastProduct.referenceNo = ref;
          else pendingRef = ref;
        }
        continue;
      }

      const partNumber = parsePartNumberLine(line);
      if (partNumber) {
        const key = partNumber.toUpperCase().replace(/\s+/g, " ");
        if (seen.has(key)) {
          pendingApp = [];
          pendingRef = "";
          continue;
        }
        seen.add(key);
        const application = flushApp();
        const product = {
          manufacturer: "MEKO",
          brand: "MEKO",
          sourcePdf: "MEKO Genuine Spares 36-page.pdf",
          sourcePage: pageNo,
          category: "Water Pump Assemblies",
          application,
          cataloguePartNumber: partNumber,
          referenceNo: pendingRef,
          mrp: null,
          sellingPrice: null,
          stock: 0,
          firm: "India Sales",
          validationStatus: application.length >= 4 ? "READY_FOR_REVIEW" : "REVIEW",
          reviewReasons: [
            "photo_catalogue_text_extract",
            application.length >= 4 ? null : "application_not_paired",
            "mrp_not_safely_paired",
            "no_stock_in_photo_catalogue",
          ].filter(Boolean),
          notes: line,
        };
        products.push(product);
        lastProduct = product;
        pendingApp = [];
        pendingRef = "";
        continue;
      }

      if (/^\(/.test(line) && lastProduct) {
        lastProduct.notes = [lastProduct.notes, line].filter(Boolean).join(" | ");
        continue;
      }

      pendingApp.push(line);
    }
  }

  return products;
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`MEKO photo catalogue PDF missing at ${PDF_PATH}`);
  }
  const { PDFParse } = loadPdfParse();
  const parser = new PDFParse({ data: fs.readFileSync(PDF_PATH) });
  const parsed = await parser.getText();
  let info = null;
  try {
    info = await parser.getInfo();
  } catch {
    info = null;
  }
  if (typeof parser.destroy === "function") await parser.destroy();

  const pages = parsed.pages?.length
    ? parsed.pages.map((page) => page.text || "")
    : parsePages(parsed.text);
  fs.writeFileSync(TEXT_PATH, parsed.text || "");

  const products = extractProducts(pages);
  const refs = products.map((p) => p.cataloguePartNumber);
  const dup = [...new Set(refs.filter((v, i, a) => v && a.indexOf(v) !== i))];
  const pageCount = Number(
    parsed.total || info?.total || pages.filter((p) => p.trim()).length,
  );
  const mCodesInText = extractMCodes(parsed.text);
  const stat = fs.statSync(PDF_PATH);

  const payload = {
    extractedAt: new Date().toISOString(),
    sourcePdf: PDF_PATH,
    byteSize: stat.size,
    pageCount,
    products,
  };
  fs.writeFileSync(EXTRACT_JSON, `${JSON.stringify(payload, null, 2)}\n`);

  const header = [
    "sourcePage",
    "category",
    "application",
    "cataloguePartNumber",
    "mrp",
    "sellingPrice",
    "stock",
    "firm",
    "validationStatus",
    "reviewReasons",
  ];
  const csv = [header.join(",")]
    .concat(
      products.map((p) =>
        header
          .map((k) => {
            const v = k === "reviewReasons" ? (p[k] || []).join("|") : (p[k] ?? "");
            return `"${String(v).replaceAll('"', '""')}"`;
          })
          .join(","),
      ),
    )
    .join("\n");
  fs.writeFileSync(EXTRACT_CSV, csv);

  const summary = {
    manufacturer: "MEKO",
    brand: "MEKO",
    firm: "India Sales",
    sourcePdf: path.resolve(PDF_PATH),
    byteSize: stat.size,
    pageCount,
    pdfInfo: info || {},
    textChars: String(parsed.text || "").length,
    uniqueMCodesInText: mCodesInText.length,
    extractedRows: products.length,
    uniquePartNumbers: new Set(refs).size,
    duplicatePartNumbers: dup,
    pagesWithText: pages.filter((p) => p.trim()).length,
    readyForReview: products.filter((p) => p.validationStatus === "READY_FOR_REVIEW").length,
    reviewRows: products.filter((p) => p.validationStatus === "REVIEW").length,
    mrpInvented: 0,
    sellingPriceInvented: 0,
    stockInvented: 0,
    imagesExtracted: 0,
    importedToDatabase: false,
    notes: [
      "Photo catalogue; most pages are image-only.",
      "MRP/DLP/stock left null/0 because price columns are not safely row-paired.",
      "Do not import BUSY/stock Excel as a substitute.",
    ],
  };
  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
