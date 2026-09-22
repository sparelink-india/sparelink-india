import { mkdirSync, writeFileSync } from "fs";
import path from "path";

const ORIGIN = "https://mekoautoindia.com";
const OUT_DIR = path.join("data", "meko-catalogue");
const IMAGE_DIR = path.join(OUT_DIR, "images");
const STORE_DIR = path.join("data", "source-catalogue", "images");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const PRODUCT_TYPE_PAGES = [
  {
    url: `${ORIGIN}/product_spare_detail?limit=100`,
    category: "Automotive Water Pump Assemblies",
    subcategory: "",
  },
  {
    url: `${ORIGIN}/pumpkits?limit=100`,
    category: "Automotive Water Pump Kits & Spares",
    subcategory: "",
  },
  {
    url: `${ORIGIN}/collection/bearing-housing-fan-assembly?limit=100`,
    category: "Bearing Housing Fan Assembly",
    subcategory: "",
  },
];

const COLLECTION_PAGES = [
  "heavy-trucks-and-buses",
  "combine-harvesters",
  "dg-gensets",
  "earthmovers",
  "light-trucks-and-buses",
  "mini-trucks-and-passenger-vehicles",
  "car",
  "tractors",
  "mini-tractors",
  "bearing-housing-fan-assembly",
];

const SEARCH_PAGES = [`${ORIGIN}/index.php?route=product/search&search=M-&limit=100`];
const EXTRA_LISTINGS = [`${ORIGIN}/latest-development?limit=100`];

function sanitizeImageKey(sku) {
  return String(sku || "").replace(/[^A-Za-z0-9._-]+/g, "_");
}

function decode(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanOem(raw) {
  const value = decode(raw);
  if (!value || /^n\/?a\.?$/i.test(value) || value.toUpperCase() === "NA") return "";
  return value;
}

function canonicalProductUrl(href) {
  try {
    const url = new URL(href, ORIGIN);
    url.hash = "";
    url.search = "";
    const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const productIdx = parts.indexOf("product");
    if (productIdx >= 0 && parts.length > productIdx + 1) {
      url.pathname = `/product/${parts[parts.length - 1]}`;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchResponse(url, accept) {
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(400 * attempt);
        lastError = new Error(`${res.status} ${url}`);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      await sleep(400 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`fetch failed ${url}`);
}

async function fetchText(url) {
  const res = await fetchResponse(url, "text/html,application/xhtml+xml");
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function pageCount(html) {
  const showing = html.match(/Showing\s+\d+\s+to\s+\d+\s+of\s+(\d+)\s+\((\d+)\s+Pages\)/i);
  if (showing) return Number(showing[2]) || 1;
  const pages = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1]));
  return pages.length ? Math.max(...pages) : 1;
}

function parseListing(html, meta) {
  const thumbs = html.split(/<div class="product-thumb\b/);
  const rows = [];
  for (const chunk of thumbs.slice(1)) {
    const partMatch = chunk.match(/text-danger">([^<]+)</i);
    const urlMatch = chunk.match(/href="(https:\/\/mekoautoindia\.com\/product\/[^"]+)"/i);
    const imgMatch = chunk.match(/src="(https:\/\/mekoautoindia\.com\/image\/[^"]+)"/i);
    const compatMatch = chunk.match(/Compatible with[\s\S]{0,400}?<a[^>]*>([\s\S]*?)<\/a>/i);
    const refMatch = chunk.match(/Ref\.\s*Nos\.[\s\S]{0,400}?<a[^>]*>([\s\S]*?)<\/a>/i);
    const partNumber = decode(partMatch?.[1] || "");
    const sourceUrl = canonicalProductUrl(urlMatch?.[1] || "");
    if (!partNumber && !sourceUrl) continue;
    rows.push({
      partNumber,
      sourceUrl,
      listingImageUrl: decode(imgMatch?.[1] || ""),
      listingApplication: decode(compatMatch?.[1] || "").replace(/\.\.$/, "").trim(),
      listingOem: cleanOem(refMatch?.[1] || ""),
      category: meta.category || "",
      subcategory: meta.subcategory || "",
      vehicleGroup: meta.vehicleGroup || "",
      listingUrl: meta.listingUrl,
    });
  }
  return rows;
}

function parseDetail(html, sourceUrl) {
  const titleMatch = html.match(/<h5>([^<]+)<\/h5>/i);
  const partFromTitle = decode(titleMatch?.[1] || "");
  const compatMatch = html.match(/Compatible with<\/p>\s*<p>([\s\S]*?)<\/p>/i);
  const refMatch = html.match(/Ref\.\s*Nos\.<\/p>\s*([\s\S]*?)<\/li>/i);
  const imageUrls = [
    ...html.matchAll(/src="(https:\/\/mekoautoindia\.com\/image\/(?:cache\/)?catalog\/product_images\/[^"]+)"/gi),
  ]
    .map((m) => decode(m[1]))
    .filter((url) => !/-74x74\./i.test(url) && !/-250x250\./i.test(url));
  const uniqueImages = [...new Set(imageUrls)];
  uniqueImages.sort((a, b) => {
    const size = (url) => {
      const hit = url.match(/-(\d+)x(\d+)\./);
      return hit ? Number(hit[1]) * Number(hit[2]) : 0;
    };
    return size(b) - size(a);
  });
  const breadcrumb = decode(
    (html.match(/breadcrumb[\s\S]{0,1200}/i)?.[0] || "").replace(/<[^>]+>/g, " "),
  );
  const priceText = decode(
    (html.match(/class="price[^"]*"[^>]*>([\s\S]{0,80})/i)?.[1] || "").replace(/<[^>]+>/g, " "),
  );
  const mrpMatch = priceText.match(/(?:₹|Rs\.?)\s*([0-9,]+(?:\.\d+)?)/i);
  return {
    partNumber: partFromTitle,
    application: decode(compatMatch?.[1] || ""),
    oem: cleanOem((refMatch?.[1] || "").replace(/<[^>]+>/g, " ")),
    imageUrls: uniqueImages,
    breadcrumb,
    mrp: mrpMatch ? Number(mrpMatch[1].replace(/,/g, "")) : null,
    sourceUrl,
  };
}

function originalImageCandidates(cacheUrl) {
  const out = [];
  try {
    const url = new URL(cacheUrl);
    const sized = url.pathname.match(/^(.*\/image\/)cache\/(catalog\/product_images\/.+)-\d+x\d+(\.[a-z0-9]+)$/i);
    if (sized) {
      out.push(`${url.origin}${sized[1]}${sized[2]}${sized[3]}`);
      out.push(`${url.origin}${sized[1]}${decodeURIComponent(sized[2])}${sized[3]}`);
    }
  } catch {
    /* ignore */
  }
  out.push(cacheUrl);
  return [...new Set(out)];
}

async function downloadImage(urls, destBase) {
  mkdirSync(IMAGE_DIR, { recursive: true });
  mkdirSync(STORE_DIR, { recursive: true });
  for (const url of urls) {
    try {
      const res = await fetchResponse(url, "image/*");
      if (!res.ok) continue;
      const type = (res.headers.get("content-type") || "").toLowerCase();
      if (type && !type.includes("image") && !type.includes("octet-stream") && !type.includes("jpeg") && !type.includes("png")) {
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 800) continue;
      const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
      const ext =
        fromUrl === ".png" || type.includes("png")
          ? ".png"
          : fromUrl === ".webp" || type.includes("webp")
            ? ".webp"
            : fromUrl === ".gif"
              ? ".gif"
              : ".jpeg";
      const archive = path.join(IMAGE_DIR, `${destBase}${ext}`);
      const store = path.join(STORE_DIR, `${destBase}${ext}`);
      writeFileSync(archive, buffer);
      writeFileSync(store, buffer);
      return { file: `${destBase}${ext}`, sourceUrl: url, bytes: buffer.length };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

async function crawlListing(startUrl, meta) {
  const first = await fetchText(startUrl);
  let pages = pageCount(first);
  const htmlPages = [{ page: 1, html: first, url: startUrl }];
  let page = 2;
  while (true) {
    if (page > pages) {
      const lastCount = parseListing(htmlPages[htmlPages.length - 1].html, meta).length;
      if (lastCount < 100) break;
      pages = page;
    }
    const url = startUrl.includes("?") ? `${startUrl}&page=${page}` : `${startUrl}?page=${page}`;
    const html = await fetchText(url);
    const count = parseListing(html, meta).length;
    if (!count) break;
    const firstUrls = new Set(
      parseListing(htmlPages[0].html, meta).map((row) => row.sourceUrl).filter(Boolean),
    );
    const thisUrls = parseListing(html, meta).map((row) => row.sourceUrl).filter(Boolean);
    if (thisUrls.length && thisUrls.every((item) => firstUrls.has(item))) break;
    htmlPages.push({ page, html, url });
    page += 1;
    if (page > 30) break;
  }
  const products = [];
  for (const item of htmlPages) {
    products.push(...parseListing(item.html, { ...meta, listingUrl: item.url }));
  }
  return { pages: htmlPages.length, products, startUrl };
}

function mergeProduct(target, incoming) {
  if (!target.partNumber && incoming.partNumber) target.partNumber = incoming.partNumber;
  if (!target.sourceUrl && incoming.sourceUrl) target.sourceUrl = incoming.sourceUrl;
  if (incoming.listingImageUrl) target.listingImageUrls.add(incoming.listingImageUrl);
  if (incoming.listingApplication && incoming.listingApplication.length > (target.listingApplication || "").length) {
    target.listingApplication = incoming.listingApplication;
  }
  if (incoming.listingOem) target.oemValues.add(incoming.listingOem);
  if (incoming.category) target.categories.add(incoming.category);
  if (incoming.vehicleGroup) target.vehicleGroups.add(incoming.vehicleGroup);
  target.listingUrls.add(incoming.listingUrl);
  return target;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(IMAGE_DIR, { recursive: true });
  const crawledPages = [];
  const merged = new Map();

  for (const page of PRODUCT_TYPE_PAGES) {
    const result = await crawlListing(page.url, page);
    crawledPages.push({ url: page.url, pages: result.pages, products: result.products.length, kind: "product-type" });
    for (const row of result.products) {
      const key = (row.partNumber || row.sourceUrl || "").trim().toLowerCase();
      if (!key) continue;
      const current = merged.get(key) || {
        partNumber: row.partNumber,
        sourceUrl: row.sourceUrl,
        listingApplication: row.listingApplication,
        listingImageUrls: new Set(),
        oemValues: new Set(),
        categories: new Set(),
        vehicleGroups: new Set(),
        listingUrls: new Set(),
      };
      merged.set(key, mergeProduct(current, row));
    }
    console.log(`listing ${page.url} → ${result.products.length} cards / ${result.pages} pages`);
  }

  for (const slug of COLLECTION_PAGES) {
    const url = `${ORIGIN}/collection/${slug}?limit=100`;
    const result = await crawlListing(url, { category: "", subcategory: "", vehicleGroup: slug });
    crawledPages.push({ url, pages: result.pages, products: result.products.length, kind: "collection" });
    for (const row of result.products) {
      const key = (row.partNumber || row.sourceUrl || "").trim().toLowerCase();
      if (!key) continue;
      const current = merged.get(key) || {
        partNumber: row.partNumber,
        sourceUrl: row.sourceUrl,
        listingApplication: row.listingApplication,
        listingImageUrls: new Set(),
        oemValues: new Set(),
        categories: new Set(),
        vehicleGroups: new Set(),
        listingUrls: new Set(),
      };
      merged.set(key, mergeProduct(current, row));
    }
    console.log(`collection ${slug} → ${result.products.length} cards / ${result.pages} pages`);
  }

  for (const url of [...EXTRA_LISTINGS, ...SEARCH_PAGES]) {
    const result = await crawlListing(url, { category: "", subcategory: "", vehicleGroup: "" });
    crawledPages.push({ url, pages: result.pages, products: result.products.length, kind: "search-or-latest" });
    for (const row of result.products) {
      const key = (row.partNumber || row.sourceUrl || "").trim().toLowerCase();
      if (!key) continue;
      const current = merged.get(key) || {
        partNumber: row.partNumber,
        sourceUrl: row.sourceUrl,
        listingApplication: row.listingApplication,
        listingImageUrls: new Set(),
        oemValues: new Set(),
        categories: new Set(),
        vehicleGroups: new Set(),
        listingUrls: new Set(),
      };
      merged.set(key, mergeProduct(current, row));
    }
    console.log(`listing ${url} → ${result.products.length} cards / ${result.pages} pages`);
  }

  const products = [...merged.values()].filter((row) => row.sourceUrl);
  console.log(`unique product URLs: ${products.length}`);

  const details = await mapLimit(products, 3, async (row, idx) => {
    try {
      const html = await fetchText(row.sourceUrl);
      const detail = parseDetail(html, row.sourceUrl);
      const partNumber = row.partNumber || detail.partNumber;
      const application = detail.application || row.listingApplication || "";
      const oems = new Set([...row.oemValues]);
      if (detail.oem) oems.add(detail.oem);
      const oem = [...oems].join(" | ");
      const categories = [...row.categories];
      const category = categories.length === 1 ? categories[0] : categories.length > 1 ? "" : "";
      const imageCandidates = [];
      for (const img of detail.imageUrls) imageCandidates.push(...originalImageCandidates(img));
      for (const img of row.listingImageUrls) imageCandidates.push(...originalImageCandidates(img));
      const imageKey = sanitizeImageKey(partNumber);
      const downloaded = partNumber ? await downloadImage(imageCandidates, imageKey) : null;
      if ((idx + 1) % 20 === 0 || idx === 0) {
        console.log(`detail ${idx + 1}/${products.length} ${partNumber}`);
      }
      return {
        brand: "MEKO",
        manufacturer: "Meko Auto Components Inc.",
        firm: "India Sales",
        partNumber,
        name: application ? `${application} (${partNumber})` : partNumber,
        description: application,
        application,
        oem: oem || "",
        category,
        subcategory: "",
        vehicleGroups: [...row.vehicleGroups],
        categoriesSeen: categories,
        sourceUrl: row.sourceUrl,
        listingUrls: [...row.listingUrls],
        officialImageUrl: downloaded?.sourceUrl || detail.imageUrls[0] || [...row.listingImageUrls][0] || "",
        imageFile: downloaded?.file || "",
        imageBytes: downloaded?.bytes || 0,
        mrp: detail.mrp,
        sellingPrice: null,
        stock: 0,
        specifications: {},
        reviewReasons: [],
      };
    } catch (error) {
      return {
        brand: "MEKO",
        manufacturer: "Meko Auto Components Inc.",
        firm: "India Sales",
        partNumber: row.partNumber,
        name: row.partNumber,
        description: row.listingApplication || "",
        application: row.listingApplication || "",
        oem: [...row.oemValues].join(" | "),
        category: [...row.categories][0] || "",
        subcategory: "",
        vehicleGroups: [...row.vehicleGroups],
        categoriesSeen: [...row.categories],
        sourceUrl: row.sourceUrl,
        listingUrls: [...row.listingUrls],
        officialImageUrl: [...row.listingImageUrls][0] || "",
        imageFile: "",
        imageBytes: 0,
        mrp: null,
        sellingPrice: null,
        stock: 0,
        specifications: {},
        reviewReasons: ["detail_fetch_failed"],
        error: error instanceof Error ? error.message : "detail failed",
      };
    }
  });

  const byPart = new Map();
  for (const row of details) {
    const key = String(row.partNumber || "").trim().toLowerCase();
    if (!key) {
      row.status = "REVIEW";
      row.reviewReasons = [...(row.reviewReasons || []), "missing_part_number"];
      continue;
    }
    if (!byPart.has(key)) byPart.set(key, []);
    byPart.get(key).push(row);
  }
  for (const group of byPart.values()) {
    if (group.length === 1) {
      const row = group[0];
      if (!row.partNumber || !row.sourceUrl || !(row.application || row.name)) {
        row.status = "REVIEW";
        row.reviewReasons = [...(row.reviewReasons || []), "incomplete_product_identity"];
      } else if (row.reviewReasons?.includes("detail_fetch_failed")) {
        row.status = "REVIEW";
      } else {
        row.status = "READY";
      }
    } else {
      for (const row of group) {
        row.status = "DUPLICATE";
        row.reviewReasons = [...(row.reviewReasons || []), "duplicate_part_number_on_website"];
      }
    }
  }

  const columns = [
    "status",
    "partNumber",
    "name",
    "application",
    "oem",
    "category",
    "subcategory",
    "sourceUrl",
    "officialImageUrl",
    "imageFile",
    "mrp",
  ];
  const csv = [
    columns.join(","),
    ...details.map((row) => columns.map((key) => csvEscape(row[key])).join(",")),
  ].join("\n");

  const summary = {
    source: ORIGIN,
    crawledPages,
    productDetailPages: details.length,
    uniquePartNumbers: byPart.size,
    READY: details.filter((row) => row.status === "READY").length,
    REVIEW: details.filter((row) => row.status === "REVIEW").length,
    DUPLICATE: details.filter((row) => row.status === "DUPLICATE").length,
    CONFLICT: 0,
    imagesDownloaded: details.filter((row) => row.imageFile).length,
    imagesMissing: details.filter((row) => !row.imageFile).length,
    mrpPublished: details.filter((row) => row.mrp != null).length,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(path.join(OUT_DIR, "website-products.json"), `${JSON.stringify(details, null, 2)}\n`);
  writeFileSync(path.join(OUT_DIR, "website-products.csv"), `${csv}\n`);
  writeFileSync(path.join(OUT_DIR, "extraction-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(
    path.join(OUT_DIR, "image-manifest.json"),
    `${JSON.stringify(
      details.map((row) => ({
        partNumber: row.partNumber,
        imageFile: row.imageFile,
        officialImageUrl: row.officialImageUrl,
        sourceUrl: row.sourceUrl,
        bytes: row.imageBytes,
      })),
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    path.join(OUT_DIR, "source-url-manifest.json"),
    `${JSON.stringify(
      details.map((row) => ({
        partNumber: row.partNumber,
        sourceUrl: row.sourceUrl,
        listingUrls: row.listingUrls,
        status: row.status,
      })),
      null,
      2,
    )}\n`,
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
