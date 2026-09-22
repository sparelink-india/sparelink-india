$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class LubricantsComposite {
  static int Dist(Color a, Color b) {
    return Math.Abs(a.R - b.R) + Math.Abs(a.G - b.G) + Math.Abs(a.B - b.B);
  }

  static Color SampleBg(Bitmap bmp) {
    int[] xs = { 2, bmp.Width / 2, bmp.Width - 3 };
    int[] ys = { 2, bmp.Height - 3 };
    int r = 0, g = 0, b = 0, n = 0;
    foreach (int y in ys) {
      foreach (int x in xs) {
        Color c = bmp.GetPixel(x, y);
        r += c.R; g += c.G; b += c.B; n++;
      }
    }
    return Color.FromArgb(r / n, g / n, b / n);
  }

  static bool IsBackground(Color c, Color bg, bool aggressive) {
    int max = Math.Max(c.R, Math.Max(c.G, c.B));
    int min = Math.Min(c.R, Math.Min(c.G, c.B));
    int chroma = max - min;
    int lum = (c.R + c.G + c.B) / 3;
    int bgLum = (bg.R + bg.G + bg.B) / 3;
    if (chroma > 18) return false;
    if (lum < 155) return false;
    if (aggressive) return Dist(c, bg) <= 90 || lum >= 200;
    if (lum >= 245 && Dist(c, bg) > 20) return false;
    return Dist(c, bg) <= 38;
  }

  static Bitmap ToArgb(Bitmap src) {
    Bitmap dst = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(dst)) {
      g.DrawImage(src, 0, 0, src.Width, src.Height);
    }
    return dst;
  }

  static Bitmap Cutout(Bitmap src, bool aggressive) {
    Bitmap bmp = ToArgb(src);
    int w = bmp.Width, h = bmp.Height;
    Color bg = SampleBg(bmp);
    bool[,] vis = new bool[w, h];
    Queue<Point> q = new Queue<Point>();

    Action<int,int> tryEnqueue = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h || vis[x, y]) return;
      Color c = bmp.GetPixel(x, y);
      if (!IsBackground(c, bg, aggressive)) return;
      vis[x, y] = true;
      q.Enqueue(new Point(x, y));
    };

    for (int x = 0; x < w; x++) { tryEnqueue(x, 0); tryEnqueue(x, h - 1); }
    for (int y = 0; y < h; y++) { tryEnqueue(0, y); tryEnqueue(w - 1, y); }

    int[] dx = { -1, 0, 1, 0, -1, -1, 1, 1 };
    int[] dy = { 0, -1, 0, 1, -1, 1, -1, 1 };
    while (q.Count > 0) {
      Point p = q.Dequeue();
      Color c = bmp.GetPixel(p.X, p.Y);
      bmp.SetPixel(p.X, p.Y, Color.FromArgb(0, c));
      for (int i = 0; i < 8; i++) tryEnqueue(p.X + dx[i], p.Y + dy[i]);
    }

    for (int y = 0; y < h; y++) {
      for (int x = 0; x < w; x++) {
        if (vis[x, y]) continue;
        Color c = bmp.GetPixel(x, y);
        if (!IsBackground(c, bg, aggressive)) continue;
        int bgN = 0;
        for (int i = 0; i < 8; i++) {
          int nx = x + dx[i], ny = y + dy[i];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (vis[nx, ny]) bgN++;
        }
        if (bgN >= 3) {
          int a = Math.Max(0, 255 - bgN * 40);
          bmp.SetPixel(x, y, Color.FromArgb(a, c));
        }
      }
    }
    return bmp;
  }

  static Rectangle Bounds(Bitmap bmp) {
    int w = bmp.Width, h = bmp.Height;
    int minX = w, minY = h, maxX = -1, maxY = -1;
    for (int y = 0; y < h; y++) {
      for (int x = 0; x < w; x++) {
        if (bmp.GetPixel(x, y).A < 16) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX) return new Rectangle(0, 0, w, h);
    return Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
  }

  public static void Run(string bottlePath, string bucketPath, string outPath) {
    using (Bitmap bottleSrc = new Bitmap(bottlePath))
    using (Bitmap bucketSrc = new Bitmap(bucketPath))
    using (Bitmap bottle = Cutout(bottleSrc, true))
    using (Bitmap bucket = Cutout(bucketSrc, false)) {
      Rectangle bb = Bounds(bottle);
      Rectangle kb = Bounds(bucket);
      const int canvas = 1100;
      const int pad = 148;
      const int gap = 28;
      int inner = canvas - pad * 2;
      int targetH = inner - 24;
      float bottleScale = (float)targetH / bb.Height;
      float bucketScale = (float)targetH / kb.Height;
      int bottleW = (int)Math.Round(bb.Width * bottleScale);
      int bucketW = (int)Math.Round(kb.Width * bucketScale);
      int totalW = bottleW + gap + bucketW;
      if (totalW > inner) {
        float shrink = (float)inner / totalW;
        bottleScale *= shrink;
        bucketScale *= shrink;
        bottleW = (int)Math.Round(bb.Width * bottleScale);
        bucketW = (int)Math.Round(kb.Width * bucketScale);
        totalW = bottleW + gap + bucketW;
      }
      int bottleH = (int)Math.Round(bb.Height * bottleScale);
      int bucketH = (int)Math.Round(kb.Height * bucketScale);
      int originX = (canvas - totalW) / 2;
      int bottleY = (canvas - bottleH) / 2;
      int bucketY = (canvas - bucketH) / 2;

      using (Bitmap canvasBmp = new Bitmap(canvas, canvas, PixelFormat.Format32bppArgb))
      using (Graphics g = Graphics.FromImage(canvasBmp)) {
        g.Clear(Color.FromArgb(255, 244, 246, 248));
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.SmoothingMode = SmoothingMode.HighQuality;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.DrawImage(bottle, new Rectangle(originX, bottleY, bottleW, bottleH), bb, GraphicsUnit.Pixel);
        g.DrawImage(bucket, new Rectangle(originX + bottleW + gap, bucketY, bucketW, bucketH), kb, GraphicsUnit.Pixel);
        canvasBmp.Save(outPath, ImageFormat.Png);
      }
    }
  }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$bottle = Join-Path $root "data\pensol-catalogue\images\4st_extra_sl.jpg"
$bucket = Join-Path $root "data\pensol-catalogue\images\ap_lr_30000_grease.jpg"
$out = Join-Path $root "public\images\category\lubricants.png"
if (-not (Test-Path $bottle)) { throw "Missing bottle: $bottle" }
if (-not (Test-Path $bucket)) { throw "Missing grease bucket: $bucket" }
[LubricantsComposite]::Run($bottle, $bucket, $out)
$item = Get-Item $out
Write-Output ("wrote {0} ({1} bytes)" -f $out, $item.Length)
