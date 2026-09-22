import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";

const ROOT = path.resolve(".next");
const IMAGE_RE =
  /(?:^|[\\/])(?:data[\\/](?:source-catalogue[\\/]images|catalogue-image-store)|public[\\/]catalogue-images)[\\/]/i;

function walk(dir, out = []) {
  if (!statSync(dir).isDirectory()) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith(".nft.json")) out.push(full);
  }
  return out;
}

if (!statSync(ROOT).isDirectory()) {
  console.log("no .next directory; skip nft strip");
  process.exit(0);
}

let filesTouched = 0;
let pathsRemoved = 0;
let remaining = 0;
const nftFiles = walk(ROOT);
for (const file of nftFiles) {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.files)) continue;
  const next = parsed.files.filter((entry) => !IMAGE_RE.test(String(entry).replace(/\\/g, "/")));
  const removed = parsed.files.length - next.length;
  if (removed) {
    parsed.files = next;
    writeFileSync(file, `${JSON.stringify(parsed)}\n`);
    filesTouched += 1;
    pathsRemoved += removed;
  }
  remaining += next.filter((entry) => IMAGE_RE.test(String(entry).replace(/\\/g, "/"))).length;
}

console.log(
  `stripped catalogue image traces: ${pathsRemoved} paths from ${filesTouched} nft files (${nftFiles.length} nft files scanned, ${remaining} image paths remaining)`,
);
if (remaining > 0) process.exit(1);
