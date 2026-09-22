import { createRequire } from "module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const require = createRequire(path.resolve("scripts/meko-tools/package.json"));
const { PNG } = require("pngjs");
const { createWorker } = require("tesseract.js");
const pdfjs = await import(
  pathToFileURL(path.resolve("scripts/meko-tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href
);

const SRC = path.resolve("CATALOGUE SOURCE/MEKO/meko catalogue.pdf");
const OUT = path.resolve("data/meko-catalogue");
const IMAGES = path.join(OUT, "product-images");
const PAGES = path.join(OUT, "pages");
const STORE = path.resolve("data/source-catalogue/images");

function slugPart(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9._-]+/g, "_");
}

function normalizeCode(raw) {
  const text = String(raw || "").toUpperCase().replace(/\s+/g, " ").trim();
  const match = text.match(/^M[-\s]?(\d{2,4})(?:\s*([A-Z]))?$/);
  if (!match) return null;
  return match[2] ? `M-${match[1]} ${match[2]}` : `M-${match[1]}`;
}

function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function toRgba(img) {
  const width = img.width;
  const height = img.height;
  const src = img.data;
  const rgba = Buffer.alloc(width * height * 4);
  if (!src) return null;
  if (src.length === width * height * 4) {
    Buffer.from(src).copy(rgba);
    return { width, height, rgba };
  }
  if (src.length === width * height * 3) {
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
      rgba[j] = src[i];
      rgba[j + 1] = src[i + 1];
      rgba[j + 2] = src[i + 2];
      rgba[j + 3] = 255;
    }
    return { width, height, rgba };
  }
  if (src.length === width * height) {
    for (let i = 0, j = 0; i < src.length; i += 1, j += 4) {
      rgba[j] = rgba[j + 1] = rgba[j + 2] = src[i];
      rgba[j + 3] = 255;
    }
    return { width, height, rgba };
  }
  return null;
}

function writePng(file, rgba) {
  const png = new PNG({ width: rgba.width, height: rgba.height });
  png.data = rgba.rgba;
  writeFileSync(file, PNG.sync.write(png));
}

async function collectImages(page) {
  const ops = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const paints = [];
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] || [];
    if (fn === pdfjs.OPS.save) stack.push(ctm.slice());
    else if (fn === pdfjs.OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === pdfjs.OPS.transform) ctm = multiply(ctm, args);
    else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintJpegXObject) {
      if (typeof args[0] === "string") paints.push({ name: args[0], x: ctm[4], y: ctm[5], w: Math.abs(ctm[0]), h: Math.abs(ctm[3]) });
    }
  }
  const out = [];
  for (const paint of paints) {
    const img = await new Promise((resolve) => {
      try {
        page.objs.get(paint.name, resolve);
      } catch {
        resolve(null);
      }
    });
    if (!img || img.width < 120 || img.height < 120) continue;
    const rgba = toRgba(img);
    if (!rgba) continue;
    out.push({ ...paint, width: img.width, height: img.height, rgba });
  }
  return out;
}

function parseTextProducts(items, page) {
  const rows = items
    .map((item) => ({
      str: String(item.str || "").replace(/\s+/g, " ").trim(),
      x: item.transform[4],
      y: item.transform[5],
    }))
    .filter((item) => item.str);
  const codes = [];
  for (const row of rows) {
    const found = [...row.str.matchAll(/\bM[-\s]?\d{2,4}(?:\s*[A-Z])?\b/gi)];
    for (const hit of found) {
      const cataloguePartNumber = normalizeCode(hit[0]);
      if (cataloguePartNumber) codes.push({ ...row, cataloguePartNumber });
    }
  }
  const products = [];
  for (const code of codes) {
    const sameCard = rows.filter(
      (row) => Math.abs(row.x - code.x) < 220 && row.y > code.y && row.y < code.y + 120,
    );
    const application = sameCard
      .map((row) => row.str)
      .filter((str) => !/^REF\.?\s*NO/i.test(str) && !/GST/i.test(str) && !normalizeCode(str) && str !== code.str)
      .join(" ")
      .trim();
    const ref = sameCard.find((row) => /^REF\.?\s*NO/i.test(row.str));
    let referenceNo = "";
    if (ref) {
      const value = ref.str.replace(/^REF\.?\s*NO\.?\s*:?\s*/i, "").trim();
      if (value && !/^(\.|…|\.\.\.)+$/.test(value)) referenceNo = value.slice(0, 80);
    }
    const reviewReasons = [];
    if (application.length < 4) reviewReasons.push("application_unreadable");
    products.push({
      manufacturer: "MEKO",
      brand: "MEKO",
      sourcePdf: "meko catalogue.pdf",
      sourcePage: page,
      category: "Water Pump Assemblies",
      application,
      cataloguePartNumber: code.cataloguePartNumber,
      referenceNo,
      mrp: null,
      sellingPrice: null,
      stock: 0,
      firm: "India Sales",
      validationStatus: reviewReasons.length ? "REVIEW" : "READY",
      reviewReasons: reviewReasons.length
        ? reviewReasons
        : ["pdf_text_extract", "mrp_not_visible", "no_stock_in_photo_catalogue"],
      imageFile: null,
      x: code.x,
      y: code.y,
    });
  }
  return products;
}

function pairImages(products, images) {
  const used = new Set();
  for (const product of products) {
    let best = null;
    let bestDist = Infinity;
    images.forEach((image, idx) => {
      if (used.has(idx)) return;
      const dist = Math.hypot(image.x - product.x, image.y - product.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { image, idx };
      }
    });
    if (best && bestDist < 280) {
      used.add(best.idx);
      product._rgba = best.image.rgba;
    }
  }
}

function dedupe(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.cataloguePartNumber.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    if ((row.application || "").length > (prev.application || "").length) map.set(key, { ...row, reviewReasons: [...new Set([...(row.reviewReasons || []), "duplicate_part_number_collapsed"])] });
  }
  return [...map.values()];
}

mkdirSync(IMAGES, { recursive: true });
mkdirSync(PAGES, { recursive: true });
mkdirSync(STORE, { recursive: true });
if (!existsSync(SRC)) throw new Error(`MEKO PDF missing: ${SRC}`);

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve("scripts/meko-tools/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const data = new Uint8Array(readFileSync(SRC));
const doc = await pdfjs.getDocument({ data, disableWorker: true, isEvalSupported: false, verbosity: 0 }).promise;
const worker = await createWorker("eng");
const collected = [];
const pageReports = [];
let imagesExtracted = 0;
let imagesUnmapped = 0;

for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
  const page = await doc.getPage(pageNum);
  const textContent = await page.getTextContent();
  const products = parseTextProducts(textContent.items, pageNum);
  const images = await collectImages(page);
  pairImages(products, images);
  const ocrCodes = [];
  if (!products.length && images.length) {
    for (const image of images) {
      const tmp = path.join(PAGES, `ocr-p${String(pageNum).padStart(2, "0")}-${slugPart(image.name)}.png`);
      writePng(tmp, image.rgba);
      const ocr = await worker.recognize(tmp);
      const text = ocr.data?.text || "";
      writeFileSync(tmp.replace(/\.png$/, ".txt"), text);
      const matches = [...text.matchAll(/\bM[-\s]?\d{2,4}(?:\s*[A-Z])?\b/gi)]
        .map((hit) => normalizeCode(hit[0]))
        .filter(Boolean);
      if (matches.length === 1) {
        ocrCodes.push({
          manufacturer: "MEKO",
          brand: "MEKO",
          sourcePdf: "meko catalogue.pdf",
          sourcePage: pageNum,
          category: "Water Pump Assemblies",
          application: "",
          cataloguePartNumber: matches[0],
          referenceNo: "",
          mrp: null,
          sellingPrice: null,
          stock: 0,
          firm: "India Sales",
          validationStatus: "REVIEW",
          reviewReasons: ["ocr_photo_only", "application_unreadable", "mrp_not_visible"],
          imageFile: null,
          _rgba: image.rgba,
        });
      }
    }
  }
  const pageProducts = products.length ? products : ocrCodes;
  for (const product of pageProducts) {
    if (product._rgba) {
      const file = `${slugPart(product.cataloguePartNumber)}.png`;
      writePng(path.join(IMAGES, file), product._rgba);
      writePng(path.join(STORE, file), product._rgba);
      product.imageFile = file;
      imagesExtracted += 1;
      delete product._rgba;
    }
  }
  const unused = images.filter((image) => !pageProducts.some((product) => product.imageFile && product._rgba === image.rgba));
  unused.forEach((image, idx) => {
    if (pageProducts.some((product) => product.imageFile)) return;
    writePng(path.join(IMAGES, `unmapped-p${String(pageNum).padStart(2, "0")}-${String(idx + 1).padStart(2, "0")}.png`), image.rgba);
    imagesUnmapped += 1;
  });
  const textDump = textContent.items.map((item) => item.str).filter(Boolean).join("\n");
  writeFileSync(path.join(PAGES, `page-${String(pageNum).padStart(2, "0")}.txt`), textDump);
  pageReports.push({
    page: pageNum,
    textChars: textDump.length,
    products: pageProducts.length,
    photos: images.length,
    ocrFallback: !products.length && images.length > 0,
  });
  collected.push(...pageProducts);
  process.stdout.write(`page ${pageNum}/${doc.numPages} products=${pageProducts.length} photos=${images.length} text=${textDump.length}\n`);
}

await worker.terminate();
await doc.destroy();

const unique = dedupe(collected.map(({ x, y, _rgba, ...row }) => row));
const READY = unique.filter((row) => row.validationStatus === "READY");
const REVIEW = unique.filter((row) => row.validationStatus === "REVIEW");
const summary = {
  sourcePdf: SRC,
  pageCount: pageReports.length,
  ocr: true,
  productBlocks: collected.length,
  uniqueProducts: unique.length,
  READY: READY.length,
  REVIEW: REVIEW.length,
  DUPLICATE: collected.length - unique.length,
  CONFLICT: 0,
  imagesExtracted,
  imagesMissing: unique.filter((row) => !row.imageFile).length,
  imagesUnmapped,
  pages: pageReports,
  notes: [
    "Part numbers on text pages come from PDF text, not guessing.",
    "Photo-only pages used OCR; unmatched or application-less rows are REVIEW.",
    "BUSY/stock Excel was not used.",
    "MRP/selling price left blank.",
  ],
};

writeFileSync(path.join(OUT, "extracted.json"), `${JSON.stringify({ extractedAt: new Date().toISOString(), sourcePdf: SRC, products: unique }, null, 2)}\n`);
const headers = ["cataloguePartNumber", "application", "referenceNo", "sourcePage", "validationStatus", "imageFile", "firm"];
writeFileSync(
  path.join(OUT, "extracted.csv"),
  `${headers.join(",")}\n${unique
    .map((row) => headers.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n")}\n`,
);
writeFileSync(path.join(OUT, "extraction-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
