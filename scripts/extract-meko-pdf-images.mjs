import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const SRC = path.resolve("CATALOGUE SOURCE/MEKO/meko catalogue.pdf");
const OUT = path.resolve("data/meko-catalogue/pdf-images");

function extractJpeg(buf) {
  const hits = [];
  let i = 0;
  while (i < buf.length - 1) {
    if (buf[i] === 0xff && buf[i + 1] === 0xd8) {
      let j = i + 2;
      while (j < buf.length - 1) {
        if (buf[j] === 0xff && buf[j + 1] === 0xd9) {
          hits.push(buf.subarray(i, j + 2));
          i = j + 2;
          break;
        }
        j += 1;
      }
      if (j >= buf.length - 1) break;
      continue;
    }
    i += 1;
  }
  return hits;
}

if (!existsSync(SRC)) throw new Error(`MEKO PDF missing: ${SRC}`);
mkdirSync(OUT, { recursive: true });
const buf = readFileSync(SRC);
const jpegs = extractJpeg(buf);
const kept = [];
jpegs.forEach((jpeg, idx) => {
  if (jpeg.length < 8000) return;
  const name = `jpeg-${String(idx + 1).padStart(4, "0")}.jpg`;
  writeFileSync(path.join(OUT, name), jpeg);
  kept.push({ name, bytes: jpeg.length });
});
writeFileSync(
  path.resolve("data/meko-catalogue/pdf-image-extract.json"),
  `${JSON.stringify({ source: SRC, jpegStreams: jpegs.length, kept: kept.length, files: kept }, null, 2)}\n`,
);
console.log(JSON.stringify({ jpegStreams: jpegs.length, kept: kept.length, out: OUT }, null, 2));
