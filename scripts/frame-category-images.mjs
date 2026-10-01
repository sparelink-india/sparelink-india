/**
 * Generate tightly-framed DERIVATIVES of the category artwork.
 *
 * WHY THIS EXISTS. The category tiles render a 1024x1024 canvas through
 * `object-contain` inside a square stage. Measured content bounds:
 *
 *     filters.png            787 x  749 of 1024 x 1024   56.2% fill
 *     engine-parts.png       946 x  364 of 1024 x 1024   32.8% fill
 *     suspension-steering    955 x  616 of 1024 x 1024   56.1% fill
 *
 * So up to a third of the visible area was empty canvas, and the products
 * inside it rendered far smaller than the tile could carry.
 *
 * WHY DERIVATIVES AND NOT A CROP OF THE SOURCE. Three reasons, and the first
 * is a hard constraint:
 *
 *   1. The catalogue's own images live on R2 and are shared by the search API,
 *      the admin editor and the storefront. Rewriting those bytes would change
 *      stored catalogue data, which this work must not do. This script only
 *      ever READS the source and only ever WRITES a new file beside it.
 *   2. The source files are the editable originals. A crop baked into them is
 *      not visible in a file browser and cannot be undone by re-running this.
 *   3. A derivative is additive. If the framing turns out to be wrong for a
 *      tile, deleting the derivative restores the previous appearance exactly.
 *
 * WHY THE CROP IS SAFE. The bounds are the true extent of non-background
 * pixels, then padded by CONTENT_MARGIN so no part of a product can be clipped.
 * This is content-aware, not a fixed percentage, so a tile that already fills
 * its canvas is left alone (lubricants.png is 100% filled and its derivative
 * is byte-identical in size) and a tile with a tall thin product gets a frame
 * that matches its shape instead of being forced square.
 *
 * WHY NOT OBJECT-COVER ANYWHERE. A cover crop would fill the tile by cutting the
 * product. On a spares site that is the one unacceptable outcome: a customer
 * must be able to see the whole part.
 *
 * IDEMPOTENT. Re-running produces the same output, and the script reports when
 * an existing derivative is already current rather than rewriting it.
 */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE_DIR = path.resolve(ROOT, "public/images/category");
const OUT_DIR = path.resolve(ROOT, "public/images/category/framed");

/**
 * Padding added around the detected content, in pixels of the SOURCE image,
 * before the crop is taken. 3% of 1024 is ~31px, which at the largest rendered
 * tile size is roughly 2-3 display pixels: enough that a soft shadow or a
 * one-pixel anti-aliased edge at the content boundary is never clipped, and
 * too small to reintroduce the whitespace this is removing.
 */
const CONTENT_MARGIN_RATIO = 0.03;

/** A pixel is "background" below this alpha, or this close to white. */
const ALPHA_FLOOR = 0.06;
const LUMA_FLOOR = 0.965;
const CHROMA_CEILING = 0.03;

const EXTS = /\.(png|jpe?g|webp)$/i;

/** The true extent of non-background pixels. */
async function contentBounds(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const alpha = data[i + 3] / 255;
      if (alpha < ALPHA_FLOOR) continue;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (luma > LUMA_FLOOR && chroma < CHROMA_CEILING) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function outName(name) {
  return name.replace(EXTS, ".webp");
}

mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
let unchanged = 0;
const rows = [];

for (const name of readdirSync(SOURCE_DIR).sort()) {
  if (!EXTS.test(name)) continue;
  const input = path.join(SOURCE_DIR, name);
  const output = path.join(OUT_DIR, outName(name));

  const meta = await sharp(input).metadata();
  const bounds = await contentBounds(input);

  if (!bounds) {
    console.log(`  skip  ${name} (no detectable content)`);
    continue;
  }

  const margin = Math.round(Math.max(meta.width, meta.height) * CONTENT_MARGIN_RATIO);
  const left = Math.max(0, bounds.left - margin);
  const top = Math.max(0, bounds.top - margin);
  const width = Math.min(meta.width - left, bounds.width + margin * 2);
  const height = Math.min(meta.height - top, bounds.height + margin * 2);

  // WebP at q82: visually indistinguishable from the PNG at these sizes, and
  // roughly a tenth of the bytes. The originals stay on disk either way.
  const buffer = await sharp(input)
    .extract({ left, top, width, height })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();

  // Idempotence: skip the write when the bytes would not change.
  if (existsSync(output) && statSync(output).size === buffer.length) {
    const current = await sharp(output).raw().toBuffer();
    const next = await sharp(buffer).raw().toBuffer();
    if (Buffer.compare(current, next) === 0) {
      unchanged += 1;
      rows.push([name, `${meta.width}x${meta.height}`, `${width}x${height}`, "current"]);
      continue;
    }
  }

  writeFileSync(output, buffer);
  written += 1;
  const gain = ((1 - buffer.length / statSync(input).size) * 100).toFixed(0);
  rows.push([name, `${meta.width}x${meta.height}`, `${width}x${height}`, `-${gain}%`]);
}

console.log("source".padEnd(26) + "source size".padEnd(15) + "framed".padEnd(14) + "bytes");
console.log("-".repeat(72));
for (const [n, a, b, c] of rows) {
  console.log(n.padEnd(26) + a.padEnd(15) + b.padEnd(14) + c);
}
console.log(`\n${written} derivative(s) written, ${unchanged} already current`);
console.log(`output: ${path.relative(ROOT, OUT_DIR)}`);
