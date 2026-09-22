const fs = require("fs");
const path = require("path");
const { cropPage, sanitize } = require("./crop-meko-photos.cjs");

const OUT_DIR = path.join("data", "meko-catalogue");
const EXISTING = path.join("catalogue-source", "MEKO", "extracted.json");

function loadJsonArray(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadTsv(file) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split("\t");
  return lines.map((line) => {
    const cols = line.split("\t");
    const row = {};
    header.forEach((key, i) => {
      row[key] = cols[i] || "";
    });
    return {
      page: Number(row.page),
      category: row.category,
      section: row.section,
      pn: row.pn.trim(),
      app: row.app.trim(),
      ref: "",
      mrp: Number(row.mrp),
      image: false,
    };
  });
}

function normalizePn(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
}

const assemblies = [
  "ocr-assemblies-p06-07.json",
  "ocr-assemblies-p08-11.json",
  "ocr-assemblies-p20-23.json",
  "ocr-assemblies-p24-27.json",
  "ocr-assemblies-p28-29.json",
].flatMap((name) => loadJsonArray(path.join(OUT_DIR, name)));

const kits = [
  "ocr-kits-p30.tsv",
  "ocr-kits-p31.tsv",
  "ocr-kits-p32.tsv",
  "ocr-kits-p33.tsv",
  "ocr-kits-p34.tsv",
].flatMap((name) => loadTsv(path.join(OUT_DIR, name)));

const existing = JSON.parse(fs.readFileSync(EXISTING, "utf8"));
const existingPns = new Set((existing.products || []).map((row) => normalizePn(row.cataloguePartNumber)));

const pageAudit = {
  1: { type: "cover", products: false },
  2: { type: "ceo_letter", products: false },
  3: { type: "precautions_marketing", products: false },
  4: { type: "company_address_warranty", products: false },
  5: { type: "index", products: false },
  12: { type: "already_text_extracted", products: false, note: "existing 89, not modified" },
  13: { type: "already_text_extracted", products: false },
  14: { type: "already_text_extracted", products: false },
  15: { type: "already_text_extracted", products: false },
  16: { type: "already_text_extracted", products: false },
  17: { type: "already_text_extracted", products: false },
  18: { type: "already_text_extracted", products: false },
  19: { type: "already_text_extracted", products: false },
  35: { type: "notes_blank", products: false },
  36: { type: "notes_blank", products: false },
};

const cropJobs = [
  { page: 6, rows: 4, cols: 2, header: 0.125, footer: 0.36 },
  { page: 7, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 8, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 9, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 11, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 21, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 23, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 24, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 25, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 26, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 27, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 28, rows: 6, cols: 2, header: 0.12, footer: 0.05 },
  { page: 29, rows: 5, cols: 2, header: 0.12, footer: 0.18 },
];

const products = [];
const seen = new Set();
for (const row of [...assemblies, ...kits]) {
  const pn = String(row.pn || "").replace(/\s+/g, " ").trim();
  const app = String(row.app || "").replace(/\s+/g, " ").trim();
  const item = {
    manufacturer: "MEKO",
    brand: "MEKO",
    sourcePdf: "MEKO Genuine Spares 36-page.pdf",
    sourcePage: row.page,
    category: row.category,
    section: row.section,
    application: app,
    cataloguePartNumber: pn,
    referenceNo: row.ref || "",
    mrp: Number.isFinite(row.mrp) && row.mrp > 0 ? row.mrp : null,
    sellingPrice: null,
    stock: 0,
    firm: "India Sales",
    imageStatus: row.image ? "CROPPED_FROM_PAGE_RENDER" : "REVIEW_NO_SAFE_PHOTO",
    imageKey: row.image ? sanitize(pn) : null,
    validationStatus: "READY",
    reviewReasons: [],
    notes: row.notes || "",
  };
  if (!pn || app.length < 4) {
    item.validationStatus = "REVIEW";
    item.reviewReasons.push("missing_identity");
  }
  const key = normalizePn(pn);
  if (seen.has(key)) {
    item.validationStatus = "DUPLICATE";
    item.reviewReasons.push("duplicate_in_ocr_extract");
  } else {
    seen.add(key);
  }
  if (existingPns.has(key)) {
    item.validationStatus = "DUPLICATE";
    item.reviewReasons.push("existing_meko_part");
    item.imageStatus = "SKIPPED_EXISTING_PRODUCT";
    item.imageKey = null;
  }
  products.push(item);
  pageAudit[row.page] = pageAudit[row.page] || { type: "product", products: true };
}

const cropped = [];
for (const job of cropJobs) {
  const pageProducts = products.filter(
    (row) =>
      row.sourcePage === job.page &&
      row.validationStatus === "READY" &&
      row.imageStatus === "CROPPED_FROM_PAGE_RENDER",
  );
  if (!pageProducts.length) continue;
  cropPage({
    ...job,
    columnMajor: true,
    products: pageProducts.map((row) => row.cataloguePartNumber),
  });
  cropped.push({ page: job.page, count: pageProducts.length });
}

const summary = {
  extractedAt: new Date().toISOString(),
  ocrTool: "pdf-parse getScreenshot + visual transcription of page renders",
  resolution: "desiredWidth 1600 PNG page renders",
  tesseract: false,
  existingMekoLeftUnchanged: 89,
  pagesInspected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  nonProductPages: [1, 2, 3, 4, 5, 35, 36],
  alreadyImportedTextPages: [12, 13, 14, 15, 16, 17, 18, 19],
  productBlocks: products.length,
  READY: products.filter((row) => row.validationStatus === "READY").length,
  REVIEW: products.filter((row) => row.validationStatus === "REVIEW").length,
  DUPLICATE: products.filter((row) => row.validationStatus === "DUPLICATE").length,
  imagesCroppedPages: cropped,
  imagesReview: products.filter((row) => row.imageStatus === "REVIEW_NO_SAFE_PHOTO").length,
  mrpPaired: products.filter((row) => row.mrp != null).length,
};

fs.writeFileSync(path.join(OUT_DIR, "extracted.json"), `${JSON.stringify({ extractedAt: summary.extractedAt, products }, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, "extraction-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, "page-audit.json"), `${JSON.stringify(pageAudit, null, 2)}\n`);
const header = ["sourcePage","category","section","application","cataloguePartNumber","referenceNo","mrp","validationStatus","imageStatus"];
const csv = [header.join(",")]
  .concat(
    products.map((p) =>
      header
        .map((k) => `"${String(p[k] ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  )
  .join("\n");
fs.writeFileSync(path.join(OUT_DIR, "extracted.csv"), csv);
console.log(JSON.stringify(summary, null, 2));
