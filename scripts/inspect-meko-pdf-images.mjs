import { createRequire } from "module";
import { readFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const pdfjs = await import(
  pathToFileURL(path.resolve("scripts/meko-tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs")).href
);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve("scripts/meko-tools/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const data = new Uint8Array(readFileSync("CATALOGUE SOURCE/MEKO/meko catalogue.pdf"));
const doc = await pdfjs.getDocument({
  data,
  disableWorker: true,
  isEvalSupported: false,
  verbosity: 0,
}).promise;

const summary = [];
for (let n = 1; n <= doc.numPages; n += 1) {
  const page = await doc.getPage(n);
  const ops = await page.getOperatorList();
  const names = [];
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    if (
      ops.fnArray[i] === pdfjs.OPS.paintImageXObject ||
      ops.fnArray[i] === pdfjs.OPS.paintInlineImageXObject ||
      ops.fnArray[i] === pdfjs.OPS.paintJpegXObject
    ) {
      names.push(ops.argsArray[i]?.[0]);
    }
  }
  const unique = [...new Set(names.filter((name) => typeof name === "string"))];
  const sizes = [];
  for (const name of unique) {
    const img = await new Promise((resolve) => {
      try {
        page.objs.get(name, resolve);
      } catch {
        resolve(null);
      }
    });
    if (img && img.width) sizes.push({ name, w: img.width, h: img.height, kind: img.kind, bytes: img.data?.length || 0 });
  }
  const text = await page.getTextContent();
  summary.push({
    page: n,
    opsImages: unique.length,
    decoded: sizes,
    textChars: text.items.map((item) => item.str || "").join("").length,
  });
  process.stdout.write(`page ${n} images=${unique.length} decoded=${sizes.length} text=${summary.at(-1).textChars}\n`);
}
await doc.destroy();
console.log(JSON.stringify({ pages: summary.length, sample: summary.slice(0, 3), imagePages: summary.filter((row) => row.decoded.some((img) => img.w > 400)).length }, null, 2));
