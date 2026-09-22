/**
 * Generate catalogue image derivatives (thumb ~400px, medium ~1200px) as WebP.
 * Never deletes or overwrites original masters.
 *
 * Usage:
 *   node scripts/generate-catalogue-derivatives.mjs --test-batch
 *   node scripts/generate-catalogue-derivatives.mjs --keys=M-641,101,104
 *   node scripts/generate-catalogue-derivatives.mjs --limit=50
 *   node scripts/generate-catalogue-derivatives.mjs --force
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import sharp from "sharp";

const IMAGE_DIR = path.resolve("data/catalogue-image-store");
const LEGACY_IMAGE_DIR = path.resolve("data/source-catalogue/images");
const MAIN_INDEX_PATH = path.resolve("data/catalogue-image-index.json");
const DERIV_INDEX_PATH = path.resolve("data/catalogue-image-derivatives.json");
const THUMB_DIR_NAME = "thumbs";
const MEDIUM_DIR_NAME = "medium";
const THUMB_WIDTH = 400;
const MEDIUM_WIDTH = 1200;
const WEBP_QUALITY = 78;
const WEBP_ALPHA_QUALITY = 85;
/** Skip JPG/JPEG thumb when already small enough for listing cards. */
const JPG_SKIP_THUMB_BYTES = 120 * 1024;
/** Skip JPG/JPEG medium when already small enough for modal display. */
const JPG_SKIP_MEDIUM_BYTES = 250 * 1024;

const args = process.argv.slice(2);
const force = args.includes("--force");
const testBatch = args.includes("--test-batch");
const keysArg = args.find((a) => a.startsWith("--keys="));
const limitArg = args.find((a) => a.startsWith("--limit="));
const requestedKeys = keysArg
  ? keysArg
      .slice("--keys=".length)
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  : null;
const limit = limitArg
  ? Math.max(1, Number(limitArg.slice("--limit=".length)) || 0)
  : null;

function resolveImageDir() {
  if (existsSync(LEGACY_IMAGE_DIR)) return LEGACY_IMAGE_DIR;
  if (existsSync(IMAGE_DIR)) return IMAGE_DIR;
  return LEGACY_IMAGE_DIR;
}

function loadMainIndex() {
  if (!existsSync(MAIN_INDEX_PATH)) return {};
  return JSON.parse(readFileSync(MAIN_INDEX_PATH, "utf8"));
}

function loadDerivIndex() {
  if (!existsSync(DERIV_INDEX_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DERIV_INDEX_PATH, "utf8"));
  } catch {
    return {};
  }
}

function pickTestBatch(index) {
  const keys = Object.keys(index);
  const largeM = [];
  const otherPng = [];
  const jpgs = [];
  const webps = [];

  for (const key of keys) {
    const ext = index[key];
    const file = path.join(resolveImageDir(), `${key}${ext}`);
    if (!existsSync(file)) continue;
    const size = statSync(file).size;
    if (ext === ".png" && /^M-/i.test(key) && size >= 1_000_000) {
      largeM.push({ key, size });
    } else if (ext === ".png" && !/^M-/i.test(key)) {
      otherPng.push({ key, size });
    } else if (ext === ".jpg" || ext === ".jpeg") {
      jpgs.push({ key, size });
    } else if (ext === ".webp") {
      webps.push({ key, size });
    }
  }

  largeM.sort((a, b) => b.size - a.size);
  otherPng.sort((a, b) => b.size - a.size);
  jpgs.sort((a, b) => b.size - a.size);

  const picked = [
    ...largeM.slice(0, 5).map((x) => x.key),
    ...otherPng.slice(0, 2).map((x) => x.key),
    ...jpgs.slice(0, 2).map((x) => x.key),
    ...webps.slice(0, 1).map((x) => x.key),
  ];
  return [...new Set(picked)].slice(0, 10);
}

async function shouldGenerate(meta, targetWidth, skipBytesForJpeg) {
  const { width, size, ext } = meta;
  if (!width || width <= targetWidth) {
    // Still generate when the file is a huge opaque-or-alpha PNG taller than wide,
    // or when bytes are clearly too large for the slot.
    if (ext === ".png" && size > skipBytesForJpeg) return true;
    if ((ext === ".jpg" || ext === ".jpeg") && size <= skipBytesForJpeg) return false;
    if (ext === ".webp" && size <= skipBytesForJpeg) return false;
    if (width && width <= targetWidth && size <= skipBytesForJpeg) return false;
  }
  if ((ext === ".jpg" || ext === ".jpeg") && size <= skipBytesForJpeg && width <= targetWidth) {
    return false;
  }
  return width > targetWidth || size > skipBytesForJpeg;
}

async function writeWebp(inputPath, outputPath, width, hasAlpha) {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const pipeline = sharp(inputPath, { failOn: "none" }).rotate().resize({
    width,
    withoutEnlargement: true,
    fit: "inside",
  });
  await pipeline
    .webp({
      quality: WEBP_QUALITY,
      alphaQuality: hasAlpha ? WEBP_ALPHA_QUALITY : undefined,
      effort: 4,
    })
    .toFile(outputPath);
}

async function processKey(imageDir, key, ext, derivIndex) {
  const inputPath = path.join(imageDir, `${key}${ext}`);
  if (!existsSync(inputPath)) {
    return { key, status: "missing-original" };
  }

  const thumbPath = path.join(imageDir, THUMB_DIR_NAME, `${key}.webp`);
  const mediumPath = path.join(imageDir, MEDIUM_DIR_NAME, `${key}.webp`);
  const originalStat = statSync(inputPath);
  const image = sharp(inputPath, { failOn: "none" });
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const hasAlpha = Boolean(metadata.hasAlpha);
  const meta = { width, height, size: originalStat.size, ext, hasAlpha };

  const needThumb = await shouldGenerate(meta, THUMB_WIDTH, JPG_SKIP_THUMB_BYTES);
  const needMedium = await shouldGenerate(meta, MEDIUM_WIDTH, JPG_SKIP_MEDIUM_BYTES);

  const existing = derivIndex[key] || {};
  let thumb = Boolean(existing.thumb);
  let medium = Boolean(existing.medium);
  const actions = [];

  if (needThumb) {
    if (force || !existsSync(thumbPath)) {
      await writeWebp(inputPath, thumbPath, THUMB_WIDTH, hasAlpha);
      actions.push("thumb");
    }
    thumb = true;
  } else if (existsSync(thumbPath)) {
    thumb = true;
  }

  if (needMedium) {
    if (force || !existsSync(mediumPath)) {
      await writeWebp(inputPath, mediumPath, MEDIUM_WIDTH, hasAlpha);
      actions.push("medium");
    }
    medium = true;
  } else if (existsSync(mediumPath)) {
    medium = true;
  }

  if (!thumb && !medium) {
    if (derivIndex[key]) delete derivIndex[key];
    return {
      key,
      status: "skipped-efficient",
      originalBytes: originalStat.size,
      width,
      height,
      ext,
      hasAlpha,
      actions,
    };
  }

  derivIndex[key] = {
    thumb,
    medium,
    ext: ".webp",
  };

  const thumbBytes = thumb && existsSync(thumbPath) ? statSync(thumbPath).size : null;
  const mediumBytes = medium && existsSync(mediumPath) ? statSync(mediumPath).size : null;

  return {
    key,
    status: actions.length ? "generated" : "exists",
    originalBytes: originalStat.size,
    thumbBytes,
    mediumBytes,
    width,
    height,
    ext,
    hasAlpha,
    thumb,
    medium,
    actions,
  };
}

function selectKeys(index) {
  if (testBatch) return pickTestBatch(index);
  if (requestedKeys) return requestedKeys;
  let keys = Object.keys(index);
  // Prefer large M-*.png first when processing batches.
  keys.sort((a, b) => {
    const aM = /^M-/i.test(a) && index[a] === ".png" ? 0 : 1;
    const bM = /^M-/i.test(b) && index[b] === ".png" ? 0 : 1;
    if (aM !== bM) return aM - bM;
    return a.localeCompare(b, undefined, { numeric: true });
  });
  if (limit) keys = keys.slice(0, limit);
  return keys;
}

const imageDir = resolveImageDir();
if (!existsSync(imageDir)) {
  console.error(`catalogue image dir missing: ${imageDir}`);
  process.exit(1);
}

const mainIndex = loadMainIndex();
const derivIndex = loadDerivIndex();
const keys = selectKeys(mainIndex);

if (!keys.length) {
  console.error("no keys selected for derivative generation");
  process.exit(1);
}

mkdirSync(path.join(imageDir, THUMB_DIR_NAME), { recursive: true });
mkdirSync(path.join(imageDir, MEDIUM_DIR_NAME), { recursive: true });

const report = [];
for (const key of keys) {
  const ext = mainIndex[key];
  if (typeof ext !== "string" || !ext.startsWith(".")) {
    report.push({ key, status: "not-in-index" });
    continue;
  }
  try {
    const row = await processKey(imageDir, key, ext, derivIndex);
    report.push(row);
    const thumbKb = row.thumbBytes != null ? `${Math.round(row.thumbBytes / 1024)}KB` : "-";
    const mediumKb = row.mediumBytes != null ? `${Math.round(row.mediumBytes / 1024)}KB` : "-";
    console.log(
      `${row.status.padEnd(18)} ${key}${ext}  ${Math.round((row.originalBytes || 0) / 1024)}KB → thumb ${thumbKb} / medium ${mediumKb}  ${row.width || "?"}x${row.height || "?"} alpha=${row.hasAlpha}`,
    );
  } catch (error) {
    report.push({ key, status: "error", error: error instanceof Error ? error.message : String(error) });
    console.error(`error ${key}:`, error);
  }
}

writeFileSync(DERIV_INDEX_PATH, `${JSON.stringify(derivIndex, null, 2)}\n`);
console.log(`\nderivatives index: ${Object.keys(derivIndex).length} keys → ${path.relative(process.cwd(), DERIV_INDEX_PATH)}`);
console.log(`processed: ${report.length}`);

const summaryPath = path.resolve("data/catalogue-image-derivatives-report.json");
writeFileSync(summaryPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2)}\n`);
console.log(`report: ${path.relative(process.cwd(), summaryPath)}`);
