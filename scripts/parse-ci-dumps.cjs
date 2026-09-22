const fs = require("fs");
const path = require("path");

function parseMarkdownDump(text, sourceUrl) {
  const products = [];
  const blocks = text.split("| Product Name:");
  for (const block of blocks.slice(1)) {
    const name = (block.match(/^\s*\|\s*(.+?)\s*\|/) || [])[1]?.trim();
    const partNumber = (block.match(/Part Number:\s*\|\s*([A-Z0-9-]+)/i) || [])[1]?.trim();
    const currentPrice = (block.match(/Current Price:\s*\|\s*([^\n|]+)/i) || [])[1]?.trim();
    const gstHsn = (block.match(/MOQ\/GST\/HSN\s*\|\s*([^\n|]+)/i) || [])[1]?.trim();
    const oe = (block.match(/OE Number:\s*\|\s*([^\n|]+)/i) || [])[1]?.trim();
    if (!name || !partNumber) continue;
    const gstMatch = gstHsn?.match(/Gst-(\d+)%/i);
    const hsnMatch = gstHsn?.match(/\b(\d{4,8})\b/);
    products.push({
      name,
      partNumber,
      brand: partNumber.startsWith("CI-") ? "CI" : null,
      currentPriceRaw: currentPrice || null,
      gstPercent: gstMatch ? Number(gstMatch[1]) : null,
      hsn: hsnMatch ? hsnMatch[1] : null,
      oeNumber:
        oe && oe !== ".." && oe !== ".. more" && oe !== "N/A" ? oe : null,
      sourceUrl,
      source: "https://onlineautohandles.com/b2b",
      status: "REVIEW",
    });
  }
  return products;
}

const dumps = [
  {
    file: "C:/Users/acer/.cursor/projects/t-sparelink-india/agent-tools/9ea5922c-4902-4adb-84e1-3921a56975b6.txt",
    url: "https://onlineautohandles.com/getresult?search=honda",
  },
  {
    file: "C:/Users/acer/.cursor/projects/t-sparelink-india/agent-tools/13c10958-8094-4c63-ab58-4ffe18d4df02.txt",
    url: "https://onlineautohandles.com/getresult?search=jcb",
  },
];

const byPart = new Map();
const duplicates = [];
for (const dump of dumps) {
  if (!fs.existsSync(dump.file)) continue;
  const parsed = parseMarkdownDump(fs.readFileSync(dump.file, "utf8"), dump.url);
  for (const product of parsed) {
    if (byPart.has(product.partNumber)) {
      duplicates.push(product.partNumber);
      continue;
    }
    byPart.set(product.partNumber, product);
  }
}

const products = [...byPart.values()];
const ready = products.filter((p) => p.partNumber && p.name);
const outDir = "T:/sparelink-india/data/source-catalogue";
fs.mkdirSync(outDir, { recursive: true });
const report = {
  extractedAt: new Date().toISOString(),
  source: "https://onlineautohandles.com/b2b",
  notes: [
    "Prepared from captured source search pages only. Full catalogue (~7000 items claimed by source) was not fully crawled in this run.",
    "No images downloaded in this run.",
    "Prices of 0 left as raw source values; not invented.",
    "Not imported to SpareLink database.",
  ],
  counts: {
    extracted: products.length,
    READY: 0,
    REVIEW: ready.length,
    DUPLICATE: new Set(duplicates).size,
    CONFLICT: 0,
    images: 0,
    imported: 0,
    skipped: 0,
  },
  products,
};
fs.writeFileSync(path.join(outDir, "validation-report.json"), JSON.stringify(report, null, 2));
const csvHeader = "partNumber,name,brand,currentPriceRaw,gstPercent,hsn,oeNumber,sourceUrl,status\n";
const csvRows = products.map((p) =>
  [p.partNumber, p.name, p.brand, p.currentPriceRaw, p.gstPercent, p.hsn, p.oeNumber, p.sourceUrl, p.status]
    .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
    .join(","),
);
fs.writeFileSync(path.join(outDir, "ci-automotive-extract.csv"), csvHeader + csvRows.join("\n"));
console.log(JSON.stringify(report.counts));
