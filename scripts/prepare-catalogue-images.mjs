import { existsSync, lstatSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import path from "path";

const IMAGE_DIR = path.resolve("data/catalogue-image-store");
const LEGACY_IMAGE_DIR = path.resolve("data/source-catalogue/images");
const INDEX_PATH = path.resolve("data/catalogue-image-index.json");
const PUBLIC_LINK = path.resolve("public/catalogue-images");
const EXTS = new Map([
  [".png", true],
  [".jpg", true],
  [".jpeg", true],
  [".webp", true],
  [".gif", true],
]);

function resolveImageDir() {
  if (existsSync(LEGACY_IMAGE_DIR)) return LEGACY_IMAGE_DIR;
  if (existsSync(IMAGE_DIR)) return IMAGE_DIR;
  return LEGACY_IMAGE_DIR;
}

function writeIndex(imageDir) {
  if (!existsSync(imageDir)) {
    if (existsSync(INDEX_PATH)) {
      console.log("catalogue image dir missing; keeping existing catalogue-image-index.json");
      return -1;
    }
    writeFileSync(INDEX_PATH, "{}\n");
    console.log("catalogue image dir missing; wrote empty catalogue-image-index.json");
    return 0;
  }
  const index = {};
  for (const name of readdirSync(imageDir)) {
    const ext = path.extname(name).toLowerCase();
    if (!EXTS.has(ext)) continue;
    const key = path.basename(name, path.extname(name));
    if (!index[key]) index[key] = ext;
  }
  writeFileSync(INDEX_PATH, `${JSON.stringify(index)}\n`);
  return Object.keys(index).length;
}

function linkPublicDir(imageDir) {
  if (process.env.VERCEL) {
    console.log("skipping public/catalogue-images junction on Vercel");
    return;
  }
  if (!existsSync(imageDir)) return;
  if (existsSync(PUBLIC_LINK)) {
    const stat = lstatSync(PUBLIC_LINK);
    if (stat.isSymbolicLink() || (stat.isDirectory() && readdirSync(PUBLIC_LINK).length === 0)) {
      rmSync(PUBLIC_LINK, { recursive: true, force: true });
    } else if (stat.isDirectory()) {
      console.log("public/catalogue-images already exists as a real directory; leaving it in place");
      return;
    }
  }
  const type = process.platform === "win32" ? "junction" : "dir";
  symlinkSync(imageDir, PUBLIC_LINK, type);
}

const imageDir = resolveImageDir();
const count = writeIndex(imageDir);
linkPublicDir(imageDir);
console.log(
  `catalogue image index: ${count} files from ${path.relative(process.cwd(), imageDir) || "."}`,
);
