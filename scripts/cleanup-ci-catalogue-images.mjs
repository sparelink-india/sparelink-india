import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = process.cwd();
const CATALOGUE_PATH = path.join(ROOT, "data", "source-catalogue", "full-catalogue.json");
const IMAGE_DIR = path.join(ROOT, "data", "source-catalogue", "images");
const BACKUP_DIR = path.join(IMAGE_DIR, "ci", "original");
const REPORT_DIR = path.join(ROOT, "data", "ci-image-cleanup");
const PREVIEW_DIR = path.join(REPORT_DIR, "preview");
const CI_BRAND = "CI AUTOMOTIVE LLP";
const args = new Set(process.argv.slice(2));
const PREVIEW_ONLY = args.has("--preview");
const APPLY = args.has("--apply");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function idx(x, y, w) {
  return (y * w + x) * 4;
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isWhiteish(r, g, b) {
  const L = lum(r, g, b);
  const c = chroma(r, g, b);
  return (Math.min(r, g, b) >= 220 && c <= 36) || (L >= 232 && c <= 40);
}

function isFaintOverlay(r, g, b) {
  const L = lum(r, g, b);
  const c = chroma(r, g, b);
  if (L < 155 || L > 242) return false;
  if (c > 80 || c < 10) return false;
  return b >= r + 5 && b >= g + 2;
}

function sampleMedianColor(data, w, h, points) {
  const rs = [];
  const gs = [];
  const bs = [];
  for (const [x, y] of points) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = idx(x, y, w);
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  }
  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);
  const mid = Math.floor(rs.length / 2);
  return [rs[mid], gs[mid], bs[mid]];
}

function edgePoints(w, h, inset) {
  const pts = [];
  for (let x = 0; x < w; x += 3) {
    pts.push([x, inset]);
    pts.push([x, h - 1 - inset]);
  }
  for (let y = 0; y < h; y += 3) {
    pts.push([inset, y]);
    pts.push([w - 1 - inset, y]);
  }
  return pts;
}

function rowStats(data, w, y) {
  const step = Math.max(1, Math.floor(w / 260));
  let n = 0;
  let white = 0;
  let dark = 0;
  let sat = 0;
  for (let x = 0; x < w; x += step) {
    n += 1;
    const i = idx(x, y, w);
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isWhiteish(r, g, b)) white += 1;
    if (lum(r, g, b) < 90) dark += 1;
    if (chroma(r, g, b) > 38) sat += 1;
  }
  return { white: white / n, dark: dark / n, sat: sat / n };
}

function colStats(data, w, h, x) {
  const step = Math.max(1, Math.floor(h / 260));
  let n = 0;
  let white = 0;
  let dark = 0;
  let sat = 0;
  for (let y = 0; y < h; y += step) {
    n += 1;
    const i = idx(x, y, w);
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isWhiteish(r, g, b)) white += 1;
    if (lum(r, g, b) < 90) dark += 1;
    if (chroma(r, g, b) > 38) sat += 1;
  }
  return { white: white / n, dark: dark / n, sat: sat / n };
}

function isFrameLine(stats) {
  return stats.dark >= 0.28 || stats.sat >= 0.4;
}

function findFrameFromStart(length, getStats, fromStart) {
  const maxInset = Math.max(16, Math.floor(length * 0.2));
  const positions = [];
  if (fromStart) {
    for (let i = 0; i < maxInset; i += 1) positions.push(i);
  } else {
    for (let i = length - 1; i > length - 1 - maxInset; i -= 1) positions.push(i);
  }
  let i = 0;
  while (i < positions.length && getStats(positions[i]).white >= 0.8) i += 1;
  if (i >= positions.length) return 0;
  const lineStart = i;
  const startPos = positions[i];
  if (!isFrameLine(getStats(startPos))) return 0;
  const maxT = Math.max(32, Math.floor(length * 0.1));
  while (i < positions.length && getStats(positions[i]).white < 0.5 && i - lineStart <= maxT) {
    i += 1;
  }
  const thickness = i - lineStart;
  if (thickness < 1 || thickness > maxT) return 0;
  if (i >= positions.length) return 0;
  if (getStats(positions[i]).white < 0.5) return 0;
  const interior = positions[Math.min(i, positions.length - 1)];
  const pad = Math.min(5, Math.max(2, Math.floor(thickness / 3) + 1));
  if (fromStart) return Math.min(length, interior + pad);
  return Math.max(0, interior - pad + 1);
}

function detectBorder(data, w, h) {
  const edgeColor = sampleMedianColor(data, w, h, edgePoints(w, h, 0));
  const top = findFrameFromStart(h, (y) => rowStats(data, w, y), true);
  const bottomRaw = findFrameFromStart(h, (y) => rowStats(data, w, y), false);
  const left = findFrameFromStart(w, (x) => colStats(data, w, h, x), true);
  const rightRaw = findFrameFromStart(w, (x) => colStats(data, w, h, x), false);
  const bottom = bottomRaw ? h - bottomRaw : 0;
  const right = rightRaw ? w - rightRaw : 0;
  const sides = [top, bottom, left, right].filter((v) => v > 0).length;
  const present = sides >= 2;
  if (!present || w - left - right < w * 0.45 || h - top - bottom < h * 0.45) {
    return { left: 0, top: 0, right: w, bottom: h, present: false, color: edgeColor };
  }
  return {
    left,
    top,
    right: w - right,
    bottom: h - bottom,
    present: true,
    color: edgeColor,
  };
}

function cropRaw(data, w, h, box) {
  const cw = box.right - box.left;
  const ch = box.bottom - box.top;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y += 1) {
    const srcStart = idx(box.left, box.top + y, w);
    data.copy(out, y * cw * 4, srcStart, srcStart + cw * 4);
  }
  return { data: out, w: cw, h: ch };
}

function foregroundMask(data, w, h) {
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    if (!isWhiteish(data[i], data[i + 1], data[i + 2])) mask[p] = 1;
  }
  return mask;
}

function reconstructionLimit(data, fg, w, h) {
  const limit = new Uint8Array(fg);
  for (let p = 0; p < w * h; p += 1) {
    if (!limit[p]) continue;
    const i = p * 4;
    if (!isFaintOverlay(data[i], data[i + 1], data[i + 2])) continue;
    const x = p % w;
    const y = (p / w) | 0;
    let whiteN = 0;
    let n = 0;
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        n += 1;
        const ni = idx(xx, yy, w);
        if (isWhiteish(data[ni], data[ni + 1], data[ni + 2])) whiteN += 1;
      }
    }
    if (whiteN / Math.max(1, n) >= 0.35) limit[p] = 0;
  }
  return limit;
}

function suppressTextBandSeeds(seeds, w, h) {
  const out = new Uint8Array(seeds);
  const top = Math.floor(h * 0.22);
  const bottom = Math.floor(h * 0.78);
  const left = Math.floor(w * 0.4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      if (!out[p]) continue;
      if (y < top && x < w * 0.55) out[p] = 0;
      else if (y >= bottom) out[p] = 0;
      else if (x < left && y < h * 0.62) out[p] = 0;
      else if (x > w * 0.82 && y > h * 0.7) out[p] = 0;
    }
  }
  return out;
}

function stripMarginText(product, w, h) {
  const labels = new Int32Array(w * h);
  const comps = [];
  const stack = [];
  let next = 1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x;
      if (!product[start] || labels[start]) continue;
      const id = next++;
      stack.length = 0;
      stack.push(start);
      labels[start] = id;
      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;
      while (stack.length) {
        const p = stack.pop();
        const cx = p % w;
        const cy = (p / w) | 0;
        area += 1;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cx > 0 && product[p - 1] && !labels[p - 1]) {
          labels[p - 1] = id;
          stack.push(p - 1);
        }
        if (cx + 1 < w && product[p + 1] && !labels[p + 1]) {
          labels[p + 1] = id;
          stack.push(p + 1);
        }
        if (cy > 0 && product[p - w] && !labels[p - w]) {
          labels[p - w] = id;
          stack.push(p - w);
        }
        if (cy + 1 < h && product[p + w] && !labels[p + w]) {
          labels[p + w] = id;
          stack.push(p + w);
        }
      }
      comps.push({
        id,
        area,
        cx: sumX / area,
        cy: sumY / area,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    }
  }
  comps.sort((a, b) => b.area - a.area);
  const drop = new Set();
  const imgArea = w * h;
  const largest = comps[0]?.area || 0;
  for (const comp of comps) {
    const areaRatio = comp.area / imgArea;
    const nx = comp.cx / w;
    const ny = comp.cy / h;
    const isLargest = comp.area === largest;
    const marginText =
      !isLargest &&
      areaRatio < 0.02 &&
      ((ny < 0.24 && nx < 0.5 && areaRatio < 0.01) ||
        ny > 0.82 ||
        (nx < 0.28 && ny < 0.7 && areaRatio < 0.012) ||
        (nx > 0.8 && ny > 0.7 && areaRatio < 0.02));
    if (marginText) drop.add(comp.id);
  }
  if (!drop.size) return product;
  const keep = new Uint8Array(product);
  for (let p = 0; p < w * h; p += 1) {
    if (drop.has(labels[p])) keep[p] = 0;
  }
  return keep;
}

function erodeMask(mask, w, h, iterations) {
  let cur = mask;
  for (let n = 0; n < iterations; n += 1) {
    const next = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const p = y * w + x;
        if (!cur[p]) continue;
        if (
          cur[p - 1] &&
          cur[p + 1] &&
          cur[p - w] &&
          cur[p + w] &&
          cur[p - w - 1] &&
          cur[p - w + 1] &&
          cur[p + w - 1] &&
          cur[p + w + 1]
        ) {
          next[p] = 1;
        }
      }
    }
    cur = next;
  }
  return cur;
}

function reconstruct(seeds, limit, w, h) {
  const out = new Uint8Array(seeds);
  const q = new Int32Array(w * h);
  let qs = 0;
  let qe = 0;
  for (let p = 0; p < w * h; p += 1) {
    if (out[p]) q[qe++] = p;
  }
  while (qs < qe) {
    const p = q[qs++];
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0 && !out[p - 1] && limit[p - 1]) {
      out[p - 1] = 1;
      q[qe++] = p - 1;
    }
    if (x + 1 < w && !out[p + 1] && limit[p + 1]) {
      out[p + 1] = 1;
      q[qe++] = p + 1;
    }
    if (y > 0 && !out[p - w] && limit[p - w]) {
      out[p - w] = 1;
      q[qe++] = p - w;
    }
    if (y + 1 < h && !out[p + w] && limit[p + w]) {
      out[p + w] = 1;
      q[qe++] = p + w;
    }
  }
  return out;
}

function componentList(mask, w, h) {
  const seen = new Uint8Array(w * h);
  const comps = [];
  const stack = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const start = y * w + x;
      if (!mask[start] || seen[start]) continue;
      stack.length = 0;
      stack.push(start);
      seen[start] = 1;
      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;
      while (stack.length) {
        const p = stack.pop();
        const cx = p % w;
        const cy = (p / w) | 0;
        area += 1;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cx > 0 && mask[p - 1] && !seen[p - 1]) {
          seen[p - 1] = 1;
          stack.push(p - 1);
        }
        if (cx + 1 < w && mask[p + 1] && !seen[p + 1]) {
          seen[p + 1] = 1;
          stack.push(p + 1);
        }
        if (cy > 0 && mask[p - w] && !seen[p - w]) {
          seen[p - w] = 1;
          stack.push(p - w);
        }
        if (cy + 1 < h && mask[p + w] && !seen[p + w]) {
          seen[p + w] = 1;
          stack.push(p + w);
        }
      }
      comps.push({
        area,
        minX,
        maxX,
        minY,
        maxY,
        cx: sumX / area,
        cy: sumY / area,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    }
  }
  comps.sort((a, b) => b.area - a.area);
  return comps;
}

function restoreStrayProducts(originalFg, product, w, h) {
  const leftover = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p += 1) leftover[p] = originalFg[p] && !product[p] ? 1 : 0;
  const comps = componentList(leftover, w, h);
  const keep = new Uint8Array(product);
  const imgArea = w * h;
  for (const comp of comps) {
    const areaRatio = comp.area / imgArea;
    const nx = comp.cx / w;
    const ny = comp.cy / h;
    const fill = comp.area / Math.max(1, comp.width * comp.height);
    const header = ny < 0.34 && nx < 0.5 && comp.height < h * 0.28;
    const footer = ny > 0.8 && comp.height < h * 0.18;
    const pack = nx > 0.78 && ny > 0.72 && areaRatio < 0.015;
    if (header || footer || pack) continue;
    const likelyPart =
      (areaRatio >= 0.002 && nx > 0.32 && ny > 0.18 && ny < 0.88) ||
      (areaRatio >= 0.004 && fill < 0.35 && nx > 0.45);
    if (!likelyPart) continue;
    for (let y = comp.minY; y <= comp.maxY; y += 1) {
      for (let x = comp.minX; x <= comp.maxX; x += 1) {
        const p = y * w + x;
        if (leftover[p]) keep[p] = 1;
      }
    }
  }
  return keep;
}

function looksLikeStarlinksCard(data, w, h) {
  let faint = 0;
  let n = 0;
  const step = 3;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      n += 1;
      const i = idx(x, y, w);
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (
        isFaintOverlay(r, g, b) ||
        (lum(r, g, b) > 170 && chroma(r, g, b) < 18 && !isWhiteish(r, g, b))
      ) {
        faint += 1;
      }
    }
  }
  const cornersWhite = [
    [3, 3],
    [w - 4, 3],
    [3, h - 4],
    [w - 4, h - 4],
  ].every(([x, y]) => {
    const i = idx(x, y, w);
    return isWhiteish(data[i], data[i + 1], data[i + 2]);
  });
  return cornersWhite && faint / n > 0.16;
}

function detectRepeatingWatermark(data, product, w, h) {
  let faintOnProduct = 0;
  let productPixels = 0;
  let faintOffProduct = 0;
  const step = 2;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const p = y * w + x;
      const i = p * 4;
      const faint = isFaintOverlay(data[i], data[i + 1], data[i + 2]);
      if (product[p]) {
        productPixels += 1;
        if (faint) faintOnProduct += 1;
      } else if (faint) {
        faintOffProduct += 1;
      }
    }
  }
  return {
    overlap: productPixels > 0 && faintOnProduct / productPixels > 0.12,
    repeatingOffProduct: faintOffProduct > 900,
  };
}

function applyProductMask(data, product, w, h) {
  const out = Buffer.from(data);
  for (let p = 0; p < w * h; p += 1) {
    if (product[p]) continue;
    const i = p * 4;
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = 255;
  }
  return out;
}

function remainingOverlayScore(data, w, h) {
  let dark = 0;
  let n = 0;
  const bands = [
    [0, 0, Math.floor(w * 0.45), Math.floor(h * 0.28)],
    [0, Math.floor(h * 0.82), Math.floor(w * 0.55), h],
  ];
  for (const [x0, y0, x1, y1] of bands) {
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        n += 1;
        const i = idx(x, y, w);
        if (lum(data[i], data[i + 1], data[i + 2]) < 70) dark += 1;
      }
    }
  }
  return dark / Math.max(1, n);
}

function blankish(data, w, h) {
  let white = 0;
  const total = w * h;
  const step = 2;
  let n = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      n += 1;
      const i = idx(x, y, w);
      if (isWhiteish(data[i], data[i + 1], data[i + 2])) white += 1;
    }
  }
  return white / n > 0.985 || total < 16;
}

async function loadImage(file) {
  const img = sharp(file, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, meta };
}

async function encodeImage(data, w, h, meta, dest) {
  const ext = path.extname(dest).toLowerCase();
  let pipeline = sharp(data, { raw: { width: w, height: h, channels: 4 } });
  if (ext === ".png") pipeline = pipeline.png({ compressionLevel: 9 });
  else if (ext === ".webp") pipeline = pipeline.webp({ quality: 95 });
  else pipeline = pipeline.jpeg({ quality: 95, mozjpeg: true });
  const tmp = `${dest}.ci-clean.tmp${ext}`;
  await pipeline.toFile(tmp);
  copyFileSync(tmp, dest);
  try {
    unlinkSync(tmp);
  } catch {
    // ignore temp cleanup
  }
}

function analyzeAndClean(data, w, h) {
  if (looksLikeStarlinksCard(data, w, h)) {
    return {
      border: { present: false, left: 0, top: 0, right: w, bottom: h },
      cropped: { data, w, h },
      cleaned: data,
      textCount: 0,
      watermarkCount: 1,
      productCount: 0,
      leftover: 0,
      action: "MANUAL_REVIEW",
      review: "repeating_catalogue_watermark_on_product",
      needsWork: false,
    };
  }
  const border = detectBorder(data, w, h);
  const cropped = border.present ? cropRaw(data, w, h, border) : { data, w, h };
  const fg = foregroundMask(cropped.data, cropped.w, cropped.h);
  const limit = reconstructionLimit(cropped.data, fg, cropped.w, cropped.h);
  const rawSeeds = erodeMask(limit, cropped.w, cropped.h, 2);
  const seeds = suppressTextBandSeeds(rawSeeds, cropped.w, cropped.h);
  const reconstructed = reconstruct(seeds, limit, cropped.w, cropped.h);
  const restored = restoreStrayProducts(limit, reconstructed, cropped.w, cropped.h);
  const product = stripMarginText(restored, cropped.w, cropped.h);
  const productPixels = product.reduce((sum, v) => sum + v, 0);
  const fgPixels = fg.reduce((sum, v) => sum + v, 0);
  const removed = Math.max(0, fgPixels - productPixels);
  const headerFooterText = remainingOverlayScore(cropped.data, cropped.w, cropped.h) > 0.012;
  const wm = detectRepeatingWatermark(cropped.data, product, cropped.w, cropped.h);
  const needsWork = border.present || removed > fgPixels * 0.02 || headerFooterText;
  const cleaned = needsWork ? applyProductMask(cropped.data, product, cropped.w, cropped.h) : cropped.data;
  const leftover = remainingOverlayScore(cleaned, cropped.w, cropped.h);
  const empty = blankish(cleaned, cropped.w, cropped.h) || productPixels < cropped.w * cropped.h * 0.004;
  const textCount = removed > 40 ? 1 : 0;
  const watermarkCount = wm.repeatingOffProduct || wm.overlap ? 1 : 0;
  let action = "ALREADY_CLEAN";
  let review = null;
  if (empty) {
    action = "FAILED";
    review = "blank_or_corrupt_output";
  } else if (!needsWork) {
    action = wm.overlap ? "MANUAL_REVIEW" : "ALREADY_CLEAN";
    review = wm.overlap ? "watermark_overlaps_product" : null;
  } else if (wm.overlap || wm.repeatingOffProduct) {
    action = "CLEANED_MANUAL_REVIEW";
    review = wm.overlap ? "watermark_overlaps_product" : "repeating_catalogue_watermark";
  } else if (leftover > 0.03) {
    action = "CLEANED_MANUAL_REVIEW";
    review = "residual_overlay_text";
  } else {
    action = "CLEANED";
  }
  return {
    border,
    cropped,
    cleaned,
    textCount,
    watermarkCount,
    productCount: componentList(product, cropped.w, cropped.h).length,
    leftover,
    action,
    review,
    needsWork,
  };
}

async function writePreviewSheet(samples) {
  ensureDir(PREVIEW_DIR);
  const report = [];
  for (const sample of samples) {
    const src = path.join(ROOT, sample.file);
    const { data, w, h, meta } = await loadImage(src);
    const result = analyzeAndClean(data, w, h);
    const dest = path.join(PREVIEW_DIR, path.basename(sample.file));
    if (result.action === "FAILED") {
      report.push({ ...sample, action: result.action, review: result.review });
      continue;
    }
    if (result.needsWork) {
      await encodeImage(result.cleaned, result.cropped.w, result.cropped.h, meta, dest);
    } else {
      copyFileSync(src, dest);
    }
    report.push({
      ...sample,
      action: result.action,
      review: result.review,
      border: result.border.present,
      textCount: result.textCount,
      watermarkCount: result.watermarkCount,
      leftover: Number(result.leftover.toFixed(4)),
    });
  }
  writeFileSync(path.join(PREVIEW_DIR, "preview-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function loadCiProducts() {
  const products = JSON.parse(readFileSync(CATALOGUE_PATH, "utf8"));
  return products.filter((p) => String(p.brand || "") === CI_BRAND);
}

async function runAuditAndApply() {
  const products = loadCiProducts();
  const withImages = [];
  const withoutImages = [];
  const fileToProducts = new Map();
  for (const p of products) {
    if (!p.localImagePath) {
      withoutImages.push({ sku: p.sku, sourceId: p.sourceId, reason: p.imageStatus || "missing" });
      continue;
    }
    const abs = path.isAbsolute(p.localImagePath) ? p.localImagePath : path.join(ROOT, p.localImagePath);
    if (!existsSync(abs)) {
      withoutImages.push({ sku: p.sku, sourceId: p.sourceId, reason: "file_missing", path: p.localImagePath });
      continue;
    }
    withImages.push(p);
    if (!fileToProducts.has(abs)) fileToProducts.set(abs, []);
    fileToProducts.get(abs).push(p);
  }

  const files = [...fileToProducts.keys()].sort();
  const selected = LIMIT > 0 ? files.slice(0, LIMIT) : files;
  const summary = {
    generatedAt: new Date().toISOString(),
    totalCiProducts: products.length,
    productsWithImages: withImages.length,
    productsWithoutImages: withoutImages.length,
    mainImages: files.length,
    galleryImages: 0,
    totalImagesScanned: 0,
    watermarkedImages: 0,
    watermarksRemoved: 0,
    borderImages: 0,
    bordersRemoved: 0,
    partNumberOverlaysFound: 0,
    partNumberOverlaysRemoved: 0,
    alreadyClean: 0,
    manualReview: 0,
    failed: 0,
    cleaned: 0,
    originalsBackedUp: 0,
    cleanImagesCreated: 0,
    missing: withoutImages.length,
    actions: {},
  };
  const rows = [];
  ensureDir(BACKUP_DIR);
  ensureDir(REPORT_DIR);

  for (const file of selected) {
    summary.totalImagesScanned += 1;
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    const productsForFile = fileToProducts.get(file);
    try {
      const backupName = path.basename(file);
      const backupPath = path.join(BACKUP_DIR, backupName);
      if (APPLY && !existsSync(backupPath) && existsSync(file)) {
        copyFileSync(file, backupPath);
        summary.originalsBackedUp += 1;
      }
      const sourcePath = existsSync(backupPath) ? backupPath : file;
      const { data, w, h, meta } = await loadImage(sourcePath);
      if (!w || !h || data.length === 0) {
        summary.failed += 1;
        summary.actions.FAILED = (summary.actions.FAILED || 0) + 1;
        rows.push({ file: rel, action: "FAILED", review: "invalid_image", skus: productsForFile.map((p) => p.sku) });
        continue;
      }
      const result = analyzeAndClean(data, w, h);
      if (result.border.present) summary.borderImages += 1;
      if (result.watermarkCount > 0) summary.watermarkedImages += 1;
      if (result.textCount > 0) summary.partNumberOverlaysFound += 1;

      let action = result.action;
      if (APPLY && result.needsWork && action !== "FAILED") {
        if (!existsSync(backupPath)) {
          copyFileSync(sourcePath, backupPath);
          summary.originalsBackedUp += 1;
        }
        await encodeImage(result.cleaned, result.cropped.w, result.cropped.h, meta, file);
        summary.cleanImagesCreated += 1;
        if (result.border.present) summary.bordersRemoved += 1;
        if (result.textCount > 0) summary.partNumberOverlaysRemoved += 1;
        if (result.watermarkCount > 0) summary.watermarksRemoved += 1;
      } else if (!result.needsWork && action === "ALREADY_CLEAN") {
        summary.alreadyClean += 1;
      }

      if (action === "FAILED") summary.failed += 1;
      else if (action === "MANUAL_REVIEW" || action === "CLEANED_MANUAL_REVIEW") summary.manualReview += 1;

      summary.actions[action] = (summary.actions[action] || 0) + 1;
      rows.push({
        file: rel,
        skus: productsForFile.map((p) => p.sku),
        action,
        review: result.review,
        border: result.border.present,
        textCount: result.textCount,
        watermarkCount: result.watermarkCount,
        leftover: Number(result.leftover.toFixed(4)),
        apply: Boolean(APPLY && result.needsWork && action !== "FAILED"),
      });
    } catch (error) {
      summary.failed += 1;
      summary.actions.FAILED = (summary.actions.FAILED || 0) + 1;
      rows.push({
        file: rel,
        action: "FAILED",
        review: String(error.message || error),
        skus: productsForFile.map((p) => p.sku),
      });
    }
    if (summary.totalImagesScanned % 250 === 0) {
      process.stdout.write(`scanned ${summary.totalImagesScanned}/${selected.length}\n`);
    }
  }

  summary.cleaned = (summary.actions.CLEANED || 0) + (summary.actions.CLEANED_MANUAL_REVIEW || 0);
  const report = {
    summary,
    withoutImages,
    manualReview: rows.filter((r) => String(r.action).includes("MANUAL") || r.action === "FAILED"),
    rows,
  };
  writeFileSync(path.join(REPORT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(REPORT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

const previewSamples = [
  { file: "data/source-catalogue/images/36087_36086L.png", note: "ref1 watermark+border+pn" },
  { file: "data/source-catalogue/images/33341_33322L.jpeg", note: "ref2 border+pn" },
  { file: "data/source-catalogue/images/102.png", note: "ci handle watermark" },
  { file: "data/source-catalogue/images/0108_M10.jpg", note: "black border text physical logo" },
  { file: "data/source-catalogue/images/342.jpg", note: "cable" },
  { file: "data/source-catalogue/images/161.jpg", note: "lock kit multipart" },
  { file: "data/source-catalogue/images/0281L.jpg", note: "window regulator" },
  { file: "data/source-catalogue/images/0120L_R.jpg", note: "small lock" },
  { file: "data/source-catalogue/images/0147L.jpg", note: "garnish physical logo" },
  { file: "data/source-catalogue/images/0295L_30118_LH.jpg", note: "mirror light text" },
  { file: "data/source-catalogue/images/21001.png", note: "starlinks filter" },
];

if (PREVIEW_ONLY) {
  writePreviewSheet(previewSamples).then((report) => {
    console.log(JSON.stringify(report, null, 2));
  });
} else {
  runAuditAndApply().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
