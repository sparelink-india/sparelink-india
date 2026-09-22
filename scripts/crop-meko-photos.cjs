const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RENDER_DIR = path.join("data", "meko-catalogue", "page-renders");
const CROP_DIR = path.join("data", "meko-catalogue", "product-images");
const STORE_DIR = path.join("data", "source-catalogue", "images");

function sanitize(sku) {
  return String(sku || "").replace(/[^A-Za-z0-9._-]+/g, "_");
}

function cropPage({ page, rows, cols, header, footer, products, columnMajor }) {
  const src = path.resolve(RENDER_DIR, `page-${String(page).padStart(2, "0")}.png`);
  if (!fs.existsSync(src)) throw new Error(`missing render ${src}`);
  fs.mkdirSync(CROP_DIR, { recursive: true });
  fs.mkdirSync(STORE_DIR, { recursive: true });

  const ps = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${src.replace(/'/g, "''")}')
$w = $src.Width
$h = $src.Height
$header = [double]${header}
$footer = [double]${footer}
$rows = ${rows}
$cols = ${cols}
$gridTop = [int]($h * $header)
$gridH = [int]($h * (1 - $header - $footer))
$cellW = [int]($w / $cols)
$cellH = [int]($gridH / $rows)
$padX = [int]($cellW * 0.04)
$padY = [int]($cellH * 0.08)
$photoW = [int]($cellW * 0.46)
$photoH = $cellH - (2 * $padY)
$outDir = '${path.resolve(CROP_DIR).replace(/'/g, "''")}'
$storeDir = '${path.resolve(STORE_DIR).replace(/'/g, "''")}'
$names = @(${products.map((p) => `'${sanitize(p).replace(/'/g, "''")}'`).join(",")})
function Save-Card($i, $r, $c) {
  if ($i -ge $names.Length -or -not $names[$i]) { return }
  $x = ($c * $cellW) + $padX
  $y = $gridTop + ($r * $cellH) + $padY
  $rect = New-Object System.Drawing.Rectangle $x, $y, $photoW, $photoH
  $bmp = New-Object System.Drawing.Bitmap $photoW, $photoH
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0,0,$photoW,$photoH), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $file = Join-Path $outDir ($names[$i] + '.jpg')
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  Copy-Item -Force $file (Join-Path $storeDir ($names[$i] + '.jpg'))
  $bmp.Dispose()
}
if (${columnMajor ? "$true" : "$false"}) {
  $i = 0
  for ($c = 0; $c -lt $cols; $c++) {
    for ($r = 0; $r -lt $rows; $r++) {
      Save-Card $i $r $c
      $i++
    }
  }
} else {
  $i = 0
  for ($r = 0; $r -lt $rows; $r++) {
    for ($c = 0; $c -lt $cols; $c++) {
      Save-Card $i $r $c
      $i++
    }
  }
}
$src.Dispose()
`;
  const result = spawnSync("powershell", ["-NoProfile", "-Command", ps], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "crop failed");
  }
}

module.exports = { sanitize, cropPage, CROP_DIR, STORE_DIR };
