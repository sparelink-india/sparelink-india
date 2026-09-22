const fs = require("fs");
const path = require("path");

const PDF_PATH = path.join(
  "catalogue-source",
  "MEKO",
  "MEKO Genuine Spares 36-page.pdf",
);
const OUT_DIR = path.join("data", "meko-catalogue", "page-renders");

function parsePagesArg(raw, fallback) {
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 36);
}

async function main() {
  const { PDFParse } = require("pdf-parse");
  if (!fs.existsSync(PDF_PATH)) throw new Error(`Missing ${PDF_PATH}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pages = parsePagesArg(process.argv[2], [1, 2, 3, 11, 20, 21, 28, 36]);
  const parser = new PDFParse({ data: fs.readFileSync(PDF_PATH) });
  const shots = await parser.getScreenshot({
    partial: pages,
    desiredWidth: 1600,
    imageDataUrl: false,
    imageBuffer: true,
  });
  const images = await parser.getImage({
    partial: pages,
    imageThreshold: 80,
    imageDataUrl: false,
    imageBuffer: false,
  });
  await parser.destroy();

  const report = [];
  for (const page of shots.pages || []) {
    const pageNo = page.pageNumber || page.num || page.page;
    const file = path.join(OUT_DIR, `page-${String(pageNo).padStart(2, "0")}.png`);
    const buf = page.data || page.buffer;
    if (buf) fs.writeFileSync(file, buf);
    const embedded = (images.pages || []).find((row) => (row.pageNumber || row.num || row.page) === pageNo);
    report.push({
      page: pageNo,
      renderBytes: buf ? buf.length : 0,
      renderPath: file,
      embeddedImageCount: embedded?.images?.length || 0,
      embeddedSizes: (embedded?.images || []).slice(0, 12).map((img) => ({
        name: img.name,
        width: img.width,
        height: img.height,
      })),
    });
    console.log(`rendered page ${pageNo} (${buf ? buf.length : 0} bytes)`);
  }
  fs.writeFileSync(
    path.join("data", "meko-catalogue", "page-render-audit.json"),
    `${JSON.stringify({ renderedAt: new Date().toISOString(), pages: report }, null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
