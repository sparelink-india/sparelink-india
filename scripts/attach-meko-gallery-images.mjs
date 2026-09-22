/**
 * Download extra official MEKO product angles already referenced by the
 * authorized catalogue (sibling files next to the stored official image).
 * Does not scrape unrelated sites. Does not invent images.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const EXTRACT = path.join("data", "meko-official-catalogue", "normalized-products.json");
const STORE_DIR = path.join("data", "source-catalogue", "images");
const BACKUP_DIR = path.join("sparelink-safety-backups", "meko-gallery");
const GALLERY_JSON = path.join("data", "meko-official-catalogue", "gallery-index.json");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function sanitizeImageKey(sku) {
  return String(sku || "").replace(/[^A-Za-z0-9._-]+/g, "_");
}

function looksLikeImage(buffer, type) {
  if (!buffer || buffer.length < 800) return false;
  if (type && /text\/html|application\/json|text\/plain/i.test(type)) return false;
  const header = buffer.subarray(0, 16);
  const png = header[0] === 0x89 && header[1] === 0x50;
  const jpeg = header[0] === 0xff && header[1] === 0xd8;
  const gif = header[0] === 0x47 && header[1] === 0x49;
  const webp = header[0] === 0x52 && header[8] === 0x57;
  return png || jpeg || gif || webp;
}

function siblingUrls(officialUrl) {
  if (!officialUrl) return [];
  try {
    const url = new URL(officialUrl);
    const base = path.posix.basename(url.pathname);
    const ext = path.posix.extname(base);
    const stem = base.slice(0, -ext.length);
    const core = stem.replace(/\.\d+$/, "");
    if (!core) return [];
    const out = [];
    out.push(`${url.origin}${path.posix.dirname(url.pathname)}/${core}${ext}`);
    for (let i = 2; i <= 6; i += 1) {
      out.push(`${url.origin}${path.posix.dirname(url.pathname)}/${core}.${i}${ext}`);
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

async function fetchImage(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "image/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") || "").toLowerCase();
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!looksLikeImage(buffer, type)) return null;
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  const ext =
    fromUrl === ".png" || type.includes("png")
      ? ".png"
      : fromUrl === ".webp" || type.includes("webp")
        ? ".webp"
        : fromUrl === ".gif"
          ? ".gif"
          : ".jpeg";
  return { buffer, ext, url };
}

async function main() {
  if (!existsSync(EXTRACT)) throw new Error("normalized-products.json missing");
  mkdirSync(STORE_DIR, { recursive: true });
  mkdirSync(BACKUP_DIR, { recursive: true });
  const products = JSON.parse(readFileSync(EXTRACT, "utf8"));
  const gallery = {};
  let extraSaved = 0;
  let skippedExisting = 0;
  let missing = 0;
  let productsWithMultiple = 0;
  let totalRefs = 0;

  for (let i = 0; i < products.length; i += 1) {
    const row = products[i];
    const pn = String(row.partNumber || "").trim();
    if (!pn || row.status !== "READY") continue;
    const key = sanitizeImageKey(pn);
    const urls = siblingUrls(row.officialImageUrl);
    const files = [];
    const hashes = new Set();
    const remember = (name, buffer) => {
      const hash = `${buffer.length}:${Buffer.from(buffer.subarray(0, 80)).toString("hex")}`;
      if (hashes.has(hash)) return false;
      hashes.add(hash);
      files.push(name);
      return true;
    };
    for (const ext of [".png", ".jpeg", ".jpg", ".webp", ".gif"]) {
      const candidate = path.join(STORE_DIR, `${key}${ext}`);
      if (!existsSync(candidate)) continue;
      remember(`${key}${ext}`, readFileSync(candidate));
      skippedExisting += 1;
      break;
    }
    for (const url of urls) {
      const got = await fetchImage(url);
      if (!got) continue;
      const hash = `${got.buffer.length}:${got.buffer.subarray(0, 80).toString("hex")}`;
      if (hashes.has(hash)) continue;
      const destKey = files.length === 0 ? key : `${key}.${files.length + 1}`;
      const destName = `${destKey}${got.ext}`;
      if (!existsSync(path.join(STORE_DIR, destName))) {
        writeFileSync(path.join(STORE_DIR, destName), got.buffer);
        extraSaved += 1;
      } else {
        skippedExisting += 1;
      }
      remember(destName, got.buffer);
    }
    const uniqueFiles = [...new Set(files)];
    if (uniqueFiles.length) {
      gallery[pn] = uniqueFiles;
      totalRefs += uniqueFiles.length;
      if (uniqueFiles.length > 1) productsWithMultiple += 1;
    } else {
      missing += 1;
    }
    if ((i + 1) % 25 === 0) {
      console.log(`gallery ${i + 1}/${products.length} extrasSaved=${extraSaved} multi=${productsWithMultiple}`);
    }
  }

  writeFileSync(path.join(BACKUP_DIR, `gallery-index-${Date.now()}.json`), `${JSON.stringify(gallery, null, 2)}\n`);
  writeFileSync(GALLERY_JSON, `${JSON.stringify({ generatedAt: new Date().toISOString(), productsWithMultiple, totalRefs, extraSaved, skippedExisting, missing, gallery }, null, 2)}\n`);
  console.log(JSON.stringify({ productsWithMultiple, totalRefs, extraSaved, skippedExisting, missing }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
