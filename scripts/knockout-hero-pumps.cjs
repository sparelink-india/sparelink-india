/* Remove plain white backgrounds from existing local water-pump rasters. */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DIR = path.join(__dirname, "..", "public/images/hero/pumps");

function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isWhiteBg(r, g, b, a) {
  if (a < 8) return true;
  const L = luma(r, g, b);
  const C = chroma(r, g, b);
  return L >= 178 && C <= 28;
}

async function knockout(file) {
  const src = path.join(DIR, file);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = data;
  const n = w * h;
  const seen = Buffer.alloc(n);
  const q = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i]) return;
    const j = i * 4;
    if (!isWhiteBg(px[j], px[j + 1], px[j + 2], px[j + 3])) return;
    seen[i] = 1;
    q.push(i);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (q.length) {
    const i = q.pop();
    const x = i % w;
    const y = (i / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  let cleared = 0;
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    if (seen[i] || isWhiteBg(px[j], px[j + 1], px[j + 2], px[j + 3])) {
      px[j + 3] = 0;
      cleared++;
    }
  }

  await sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toFile(src);
  console.log(file, "cleared", cleared, "of", n);
}

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".png"));
  for (const f of files) await knockout(f);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
