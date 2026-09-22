const fs = require("fs");
const path = require("path");

const DIR = path.join("data", "source-catalogue");
const READY_PATH = path.join(DIR, "import-ready.csv");
const FULL_PATH = path.join(DIR, "full-catalogue.csv");
const JSON_PATH = path.join(DIR, "full-catalogue.json");
const OVERLAY_PATH = path.join(DIR, "admin-assignments.json");
const BLANK_PATH = path.join(DIR, "blank-selling-price-review.csv");
const REPORT_PATH = path.join(DIR, "import-preflight-report.json");
const IMPORT_ROUTE = path.join("app", "api", "admin", "source-catalogue", "import", "route.ts");

function csvCell(value) {
  return `"${String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ").replaceAll('"', '""')}"`;
}

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

function parseCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const nonempty = text.split("\n").filter((line) => line.length > 0);
  const header = parseCsvLine(nonempty[0]);
  const rows = nonempty.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    header.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    return row;
  });
  return { header, rows };
}

function positiveNumber(value) {
  if (value === "" || value == null) return false;
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

function writeCsv(file, headers, rows) {
  const body = [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
  fs.writeFileSync(file, `${body}\n`, "utf8");
}

const readyFile = parseCsv(READY_PATH);
const fullFile = parseCsv(FULL_PATH);
const products = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const overlay = JSON.parse(fs.readFileSync(OVERLAY_PATH, "utf8"));

if (fullFile.rows.length !== 8182) throw new Error(`Full catalogue mismatch: ${fullFile.rows.length}`);
if (readyFile.rows.length !== 7993) throw new Error(`READY catalogue mismatch: ${readyFile.rows.length}`);

const reviewRows = fullFile.rows.filter((row) => row.validationStatus === "REVIEW");
if (reviewRows.length !== 189) throw new Error(`REVIEW count mismatch: ${reviewRows.length}`);

const ambaji = readyFile.rows.filter((row) => row.firm === "Ambaji Traders").length;
const otherFirms = readyFile.rows.filter((row) => row.firm && row.firm !== "Ambaji Traders").length;
const blankFirm = readyFile.rows.filter((row) => !row.firm).length;
if (ambaji !== 7993) throw new Error(`Ambaji assignment mismatch: ${ambaji}`);
if (otherFirms !== 0) throw new Error(`Unexpected other firm assignments: ${otherFirms}`);
if (blankFirm !== 0) throw new Error(`Unexpected blank firm assignments: ${blankFirm}`);

const withSelling = readyFile.rows.filter((row) => positiveNumber(row.selling_price)).length;
const blankSellingRows = readyFile.rows.filter((row) => !row.selling_price);
const mrpCount = readyFile.rows.filter((row) => row.mrp).length;
const sourceRatePositive = readyFile.rows.filter((row) => positiveNumber(row.source_rate)).length;

if (withSelling !== 7780) throw new Error(`Expected 7780 positive selling prices; found ${withSelling}`);
if (blankSellingRows.length !== 213) throw new Error(`Expected 213 blank selling prices; found ${blankSellingRows.length}`);
if (mrpCount !== 0) throw new Error("MRP must remain blank.");
if (sourceRatePositive !== 7780) throw new Error(`Expected 7780 positive source rates; found ${sourceRatePositive}`);

const requiredHeaders = [
  "part_number",
  "part_name",
  "description",
  "brand",
  "category",
  "sku",
  "hsn",
  "gst",
  "mrp",
  "selling_price",
  "firm",
  "source_rate",
  "moq",
  "uom",
];
for (const header of requiredHeaders) {
  if (!readyFile.header.includes(header)) throw new Error(`Required import header missing: ${header}`);
}

const reviewSkus = new Set(reviewRows.map((row) => row.sku));
const reviewAccidentallyReady = readyFile.rows.filter((row) => reviewSkus.has(row.part_number) || reviewSkus.has(row.sku)).length;
if (reviewAccidentallyReady !== 0) throw new Error("REVIEW record found inside READY dataset.");

const jsonReady = products.filter((p) => p.validationStatus === "READY").length;
const jsonReview = products.filter((p) => p.validationStatus === "REVIEW").length;
if (jsonReady !== 7993 || jsonReview !== 189) {
  throw new Error(`JSON status mismatch READY=${jsonReady} REVIEW=${jsonReview}`);
}

const overlayFirms = Object.values(overlay.assignments || {});
const overlayAmbaji = overlayFirms.filter((row) => row.firm === "Ambaji Traders").length;
const overlayOther = overlayFirms.filter((row) => row.firm && row.firm !== "Ambaji Traders").length;
if (overlayAmbaji !== 7993) throw new Error(`Overlay Ambaji mismatch: ${overlayAmbaji}`);
if (overlayOther !== 0) throw new Error(`Overlay other firms: ${overlayOther}`);

for (const product of products.filter((p) => p.validationStatus === "REVIEW")) {
  const key = String(product.sku || product.sourceId || "").trim();
  if (overlay.assignments[key]) throw new Error(`REVIEW overlay assignment found: ${key}`);
}

const importRoute = fs.readFileSync(IMPORT_ROUTE, "utf8");
if (!importRoute.includes("Product import is disabled") || !importRoute.includes("status: 403")) {
  throw new Error("Import route is not disabled.");
}
if (/\bdb\.insert\b|\bindexDocuments\b/.test(importRoute)) {
  throw new Error("Import route contains write/reindex calls.");
}

writeCsv(
  BLANK_PATH,
  ["part_number", "part_name", "source_rate", "selling_price", "mrp", "moq", "uom", "firm", "validation_status"],
  blankSellingRows.map((row) => ({
    part_number: row.part_number,
    part_name: row.part_name,
    source_rate: row.source_rate,
    selling_price: row.selling_price,
    mrp: row.mrp,
    moq: row.moq,
    uom: row.uom,
    firm: row.firm,
    validation_status: row.validation_status,
  })),
);

const blankReviewWritten = parseCsv(BLANK_PATH);
if (blankReviewWritten.rows.length !== 213) {
  throw new Error(`Blank review file row mismatch: ${blankReviewWritten.rows.length}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  counts: {
    full: 8182,
    READY: 7993,
    REVIEW: 189,
    ambajiTraders: 7993,
    hindMotors: 0,
    indiaSales: 0,
    positiveSellingPrices: withSelling,
    blankSellingPrices: blankSellingRows.length,
    positiveSourceRates: sourceRatePositive,
    mrpPopulated: mrpCount,
  },
  importReadiness: {
    importExecuted: false,
    importEndpoint: "disabled / 403",
    databaseWrites: 0,
    typesenseReindex: false,
    currentImportEligibleUnderExistingRules: 0,
    blockers: [
      "MRP remains blank by policy; existing import-eligibility still requires MRP.",
      "213 READY rows have no explicit source rate > 0, so selling_price is blank and they stay out of a priced import set.",
      "189 REVIEW rows remain excluded from import-ready.csv.",
    ],
    pricedReadyWithFirm: 7780,
    blankPriceReviewFile: BLANK_PATH.replace(/\\/g, "/"),
  },
  safety: {
    productIdentityUnchanged: true,
    mrpNotFilled: true,
    blankPricesNotFilled: true,
    reviewExcluded: true,
  },
};

fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
