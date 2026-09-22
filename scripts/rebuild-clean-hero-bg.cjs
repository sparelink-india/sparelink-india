/* Rebuild cinematic clean hero plate: vehicles + road, no baked UI, no rectangular patches. */
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public/images/hero/approved-scene.png");
const OUT = path.join(ROOT, "public/images/hero/sparelink-clean-hero-bg.png");

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function ellipseW(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const d = nx * nx + ny * ny;
  if (d >= 1) return 0;
  if (d <= 0.42) return 1;
  return 1 - (d - 0.42) / 0.58;
}

function neighborhoodInk(src, w, h, x, y) {
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const i = (yy * w + xx) * 3;
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      if (luma(r, g, b) > 138) return true;
      if (r > 145 && g > 105 && b < 145 && r - b > 22) return true;
    }
  }
  return false;
}

function allowScenePixel(src, w, h, x, y, r, g, b) {
  if (x < 268 || x > 942) return false;
  const L = luma(r, g, b);
  const C = chroma(r, g, b);
  if (L > 130 && C < 90) return false;
  if (r > 140 && g > 100 && b < 145 && r - b > 25) return false;
  const headline = x > 300 && x < 920 && y > 12 && y < 312;
  const cta = y > 312 && y < 422 && x > 350 && x < 880;
  const badges = y > 418 && y < 590 && x > 280 && x < 940;
  if (headline || cta || badges) {
    if (neighborhoodInk(src, w, h, x, y)) return false;
  }
  if (headline) return x < 470 && y > 70 && L < 80 && C > 8;
  if (cta) return false;
  if (badges) return y > 548 && L < 40;
  return L < 155;
}

async function main() {
  const { data, info } = await sharp(SRC)
    .extract({ left: 0, top: 56, width: 1230, height: 603 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const src = data;
  const plate = Buffer.alloc(w * h * 3);

  const sample = (x, y) => {
    const xx = Math.max(0, Math.min(w - 1, x | 0));
    const yy = Math.max(0, Math.min(h - 1, y | 0));
    const i = (yy * w + xx) * 3;
    return [src[i], src[i + 1], src[i + 2]];
  };

  for (let y = 0; y < h; y++) {
    const sy = Math.max(40, Math.min(y, 255));
    const [lr, lg, lb] = sample(318, sy);
    const [rr, rg, rb] = sample(888, sy);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const t = Math.max(0, Math.min(1, (x - 260) / 700));
      let r = Math.round(lr * (1 - t) + rr * t);
      let g = Math.round(lg * (1 - t) + rg * t);
      let b = Math.round(lb * (1 - t) + rb * t);
      const si = (y * w + x) * 3;
      if (allowScenePixel(src, w, h, x, y, src[si], src[si + 1], src[si + 2])) {
        r = src[si];
        g = src[si + 1];
        b = src[si + 2];
      }
      plate[i] = r;
      plate[i + 1] = g;
      plate[i + 2] = b;
    }
  }

  const atmos = await sharp(plate, { raw: { width: w, height: h, channels: 3 } })
    .blur(36)
    .raw()
    .toBuffer();
  const out = Buffer.from(atmos);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const truck = ellipseW(x, y, 408, 232, 158, 198);
      const car = ellipseW(x, y, 848, 335, 140, 172);
      const road = ellipseW(x, y, 620, 530, 310, 120);
      const wgt = Math.max(truck, car, road);
      if (wgt <= 0.05) continue;
      const i = (y * w + x) * 3;
      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];
      if (!allowScenePixel(src, w, h, x, y, r, g, b)) continue;
      out[i] = Math.round(r * wgt + out[i] * (1 - wgt));
      out[i + 1] = Math.round(g * wgt + out[i + 1] * (1 - wgt));
      out[i + 2] = Math.round(b * wgt + out[i + 2] * (1 - wgt));
    }
  }

  const scene = await sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .blur(0.7)
    .png()
    .toBuffer();

  const scaled = await sharp(scene).resize({ height: 720, fit: "inside" }).png().toBuffer();
  const sm = await sharp(scaled).metadata();
  const canvasW = 1920;
  const canvasH = 720;
  const left = Math.round((canvasW - (sm.width || 0)) / 2);
  const midX = Math.max(0, Math.floor(((sm.width || 200) - 120) / 2));
  const side = await sharp(scaled)
    .extract({ left: midX, top: 0, width: 120, height: sm.height || canvasH })
    .resize({ width: canvasW, height: canvasH, fit: "fill" })
    .blur(42)
    .png()
    .toBuffer();

  await sharp(side)
    .composite([{ input: scaled, left, top: 0 }])
    .png({ compressionLevel: 8 })
    .toFile(OUT);

  const meta = await sharp(OUT).metadata();
  console.log("wrote", OUT, meta.width, "x", meta.height);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
