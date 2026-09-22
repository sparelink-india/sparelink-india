const fs = require("fs");
const sharp = require("sharp");

const SRC = "T:/sparelink-india/public/images/brand/sparelink-india-logo.png";
const BACKUP = "T:/sparelink-india/public/images/brand/sparelink-india-logo-source.png";

function isBackground(r, g, b) {
  return r <= 28 && g <= 28 && b <= 28;
}

async function main() {
  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(SRC, BACKUP);
  }

  const { data, info } = await sharp(BACKUP)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const stack = [];

  function tryEnqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * channels;
    if (!isBackground(data[i], data[i + 1], data[i + 2])) return;
    visited[p] = 1;
    stack.push(p);
  }

  for (let x = 0; x < width; x += 1) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  let cleared = 0;
  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    const y = (p - x) / width;
    const i = p * channels;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    cleared += 1;
    tryEnqueue(x + 1, y);
    tryEnqueue(x - 1, y);
    tryEnqueue(x, y + 1);
    tryEnqueue(x, y - 1);
  }

  await sharp(data, { raw: { width, height, channels } })
    .trim({ threshold: 8 })
    .png({ compressionLevel: 9 })
    .toFile(SRC);

  const meta = await sharp(SRC).metadata();
  console.log(
    JSON.stringify({
      backup: BACKUP,
      dest: SRC,
      original: { width, height },
      clearedBackgroundPixels: cleared,
      output: { width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha },
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
