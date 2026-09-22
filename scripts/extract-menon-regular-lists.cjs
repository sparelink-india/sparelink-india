const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const outDir = path.join("T:/sparelink-india/data/menon-brakes-catalogue");
fs.mkdirSync(outDir, { recursive: true });

function parseList(xlsxPath, sourcePdf, listKind) {
  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const header0 = String(rows[0]?.[0] || "").trim();
  const header1 = String(rows[1]?.[0] || "").trim();
  let section = "";
  let application = "";
  let reference = "";
  const products = [];
  for (let i = 2; i < rows.length; i += 1) {
    const row = rows[i].map((c) => String(c ?? "").replace(/\s+/g, " ").trim());
    const [c0, c1, c2, c3, c4, c5] = [row[0] || "", row[1] || "", row[2] || "", row[3] || "", row[4] || "", row[5] || ""];
    if (!c0 && !c1 && !c2 && !c3 && !c4 && !c5) continue;
    const looksHeader = /reference no/i.test(c1) && /mrp/i.test(c4);
    if (looksHeader) {
      section = c0 || section;
      continue;
    }
    if (c0 && !c1 && !c2 && !c3 && !c4) {
      section = c0;
      continue;
    }
    if (c0) application = c0;
    if (c1) reference = c1;
    const size = c2;
    const pcs = c3 ? Number(c3) : null;
    const mrp = c4 ? Number(c4) : null;
    const dist = c5 ? Number(c5) : null;
    const reasons = ["no_authoritative_firm_mapping"];
    if (!application) reasons.push("missing_application");
    if (!reference) reasons.push("missing_reference");
    if (!size) reasons.push("missing_size");
    if (mrp == null || !Number.isFinite(mrp)) reasons.push("missing_mrp");
    if (!c0) reasons.push("application_forward_filled");
    const partNumber = reference && size ? `${reference}/${size.replace(/\s+/g, "")}` : reference;
    products.push({
      manufacturer: header0 || "MENON BRAKES LIMITED",
      brand: "Menon",
      listTitle: header1,
      listKind,
      sourcePdf,
      sourceXlsx: xlsxPath,
      sourceRow: i + 1,
      section: section || null,
      application: application || null,
      cataloguePartNumber: partNumber,
      referenceNo: reference || null,
      size: size || null,
      pcsPerSet: Number.isFinite(pcs) ? pcs : null,
      mrp: Number.isFinite(mrp) ? mrp : null,
      priceToDistributors: Number.isFinite(dist) ? dist : null,
      sellingPrice: null,
      stock: 0,
      gst: null,
      firm: null,
      validationStatus: "REVIEW",
      reviewReasons: reasons,
      notes:
        "Selling price left blank. Distributor price captured from source only. Stock not imported.",
    });
  }
  return { header0, header1, products };
}

const hcv = parseList(
  "C:/Users/acer/Downloads/REGULAR HCV.xlsx",
  "C:/Users/acer/Downloads/REGULAR HCV.pdf",
  "HCV",
);
const lcv = parseList(
  "C:/Users/acer/Downloads/REGULAR LCV.xlsx",
  "C:/Users/acer/Downloads/REGULAR LCV.pdf",
  "LCV",
);
const products = [...hcv.products, ...lcv.products];
const refs = products.map((p) => p.cataloguePartNumber);
const dup = [...new Set(refs.filter((v, i, a) => v && a.indexOf(v) !== i))];

fs.writeFileSync(path.join(outDir, "extracted.json"), JSON.stringify({ extractedAt: new Date().toISOString(), products }, null, 2));

const header = [
  "listKind",
  "section",
  "application",
  "cataloguePartNumber",
  "referenceNo",
  "size",
  "pcsPerSet",
  "mrp",
  "priceToDistributors",
  "sellingPrice",
  "stock",
  "firm",
  "validationStatus",
  "reviewReasons",
  "sourcePdf",
  "sourceRow",
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
fs.writeFileSync(path.join(outDir, "extracted.csv"), csv);

const summary = {
  manufacturer: "MENON BRAKES LIMITED",
  brand: "Menon",
  pdfTextExtractable: false,
  pdfProducer: "Microsoft: Print To PDF",
  structuredSource: "companion xlsx files saved 3 minutes after the PDFs",
  pdfs: [
    { file: "REGULAR HCV.pdf", pagesFromPdfDict: 4, rows: hcv.products.length },
    { file: "REGULAR LCV.pdf", pagesFromPdfDict: 1, rows: lcv.products.length },
  ],
  productRows: products.length,
  uniquePartNumbers: new Set(refs).size,
  duplicateGeneratedPartNumbers: dup,
  reviewRows: products.length,
  importedToDatabase: false,
};
fs.writeFileSync(path.join(outDir, "extraction-summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
