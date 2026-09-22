import { existsSync, linkSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "fs";
import path from "path";

const ORIGIN = "https://mekoautoindia.com";
const CATALOGUE_URL = `${ORIGIN}/product_spare_detail`;
const OUT_DIR = path.join("data", "meko-official-catalogue");
const ORIGINAL_IMAGE_DIR = path.join(OUT_DIR, "original-images");
const STORE_DIR = path.join("data", "source-catalogue", "images");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const KIT_TAB_SUBCATEGORIES = {
  home: "Water Pumps Repair kits without Bearing",
  menu1: "Water Pumps Repair kits with Bearing",
  menu2: "Water Pumps Seal kits",
  menu3: "Water Pumps Seals",
  menu4: "Water Pumps shafts or intergral shaft Bearings",
  menu5: "Water Pumps impellers",
  menu6: "Ceramics",
};

function sanitizeImageKey(sku) {
  return String(sku || "").replace(/[^A-Za-z0-9._-]+/g, "_");
}

function decode(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function compact(value) {
  return decode(value).replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function isUnavailableRef(value) {
  const text = compact(value);
  return !text || /^(n\/?a\.?|na|n\.a\.|not listed|nil|-)$/i.test(text);
}

function splitRefNos(raw) {
  const text = compact(raw);
  if (isUnavailableRef(text)) return [];
  return text
    .split(/\s*(?:,|;|\||\n)\s*/)
    .map((item) => item.trim())
    .filter((item) => item && !isUnavailableRef(item));
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

function listingIdentity(partNumber, sourceUrl) {
  const pn = compact(partNumber);
  if (pn) return `pn:${pn.toLowerCase()}`;
  if (sourceUrl) return `url:${sourceUrl.toLowerCase()}`;
  return "";
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

function discoverNav(html) {
  const hrefs = [...html.matchAll(/href="(https:\/\/mekoautoindia\.com\/[^"]+)"/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
  const unique = [...new Set(hrefs)];
  return {
    collections: unique.filter((url) => /\/collection\/[^/?#]+/i.test(url)).map((url) => url.split("?")[0].replace(/\/$/, "")),
    brands: unique.filter((url) => /\/brand\/[^/?#]+/i.test(url)).map((url) => url.split("?")[0].replace(/\/$/, "")),
    products: unique.filter((url) => /\/product\/[^/?#]+/i.test(url)).map((url) => canonicalProductUrl(url)).filter(Boolean),
  };
}

function parseListing(html, meta) {
  const thumbs = html.split(/<div class="product-thumb\b/);
  const rows = [];
  for (const chunk of thumbs.slice(1)) {
    const partMatch = chunk.match(/text-danger">([^<]+)</i);
    const urlMatch = chunk.match(/href="(https:\/\/mekoautoindia\.com\/product\/[^"]+)"/i);
    const imgMatch = chunk.match(/src="(https:\/\/mekoautoindia\.com\/image\/[^"]+)"/i);
    const compatMatch = chunk.match(/Compatible with[\s\S]{0,800}?<a[^>]*>([\s\S]*?)<\/a>/i);
    const refMatch = chunk.match(/Ref\.\s*Nos\.[\s\S]{0,800}?<a[^>]*>([\s\S]*?)<\/a>/i);
    const partNumber = compact(partMatch?.[1] || "");
    const sourceUrl = canonicalProductUrl(urlMatch?.[1] || "");
    if (!partNumber && !sourceUrl) continue;
    rows.push({
      partNumber,
      sourceUrl,
      listingImageUrl: compact(imgMatch?.[1] || ""),
      listingApplication: compact(compatMatch?.[1] || "").replace(/\.\.$/, "").trim(),
      listingOemRaw: compact(refMatch?.[1] || ""),
      category: meta.category || "",
      subcategory: meta.subcategory || "",
      vehicleType: meta.vehicleType || "",
      vehicleBrand: meta.vehicleBrand || "",
      vehicleGroup: meta.vehicleGroup || "",
      listingUrl: meta.listingUrl,
      recordKind: meta.recordKind || "product-card",
    });
  }
  return rows;
}

function parseKitTables(html) {
  const rows = [];
  for (const [tabId, subcategory] of Object.entries(KIT_TAB_SUBCATEGORIES)) {
    const tabRe = new RegExp(
      `<div[^>]*id="${tabId}"[^>]*>([\\s\\S]*?)(?:<div[^>]*id="menu|<div[^>]*class="tab-pane|$)`,
      "i",
    );
    const tabHtml = html.match(tabRe)?.[1] || "";
    if (!tabHtml) continue;
    const trs = tabHtml.split(/<tr\b/i).slice(1);
    for (const tr of trs) {
      const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => compact(m[1]));
      if (cells.length < 2) continue;
      if (/^part\s*no\.?$/i.test(cells[0]) || /^description$/i.test(cells[1])) continue;
      const partNumber = cells[0];
      const application = cells.slice(1).join(" ").trim();
      if (!partNumber || !/^m{1,2}[\w/-]/i.test(partNumber.replace(/\s+/g, ""))) continue;
      rows.push({
        partNumber,
        sourceUrl: `${ORIGIN}/pumpkits`,
        listingImageUrl: "",
        listingApplication: application,
        listingOemRaw: "",
        category: "Automotive Water Pump Kits & Spares",
        subcategory,
        vehicleType: "",
        vehicleBrand: "",
        vehicleGroup: "",
        listingUrl: `${ORIGIN}/pumpkits#${tabId}`,
        recordKind: "kit-table",
      });
    }
  }
  return rows;
}

function parseDetail(html, sourceUrl) {
  const titleMatch = html.match(/<h5>([^<]+)<\/h5>/i);
  const partFromTitle = compact(titleMatch?.[1] || "");
  const compatMatch = html.match(/Compatible with<\/p>\s*<p>([\s\S]*?)<\/p>/i);
  const refMatch = html.match(/Ref\.\s*Nos\.<\/p>\s*([\s\S]*?)<\/li>/i);
  const imageUrls = [
    ...html.matchAll(/src="(https:\/\/mekoautoindia\.com\/image\/(?:cache\/)?catalog\/product_images\/[^"]+)"/gi),
  ]
    .map((m) => compact(m[1]))
    .filter((url) => !/-74x74\./i.test(url) && !/-250x250\./i.test(url) && !/-300x300\./i.test(url));
    const uniqueImages = [...new Set(imageUrls)];
    uniqueImages.sort((a, b) => {
      const size = (url) => {
        const hit = url.match(/-(\d+)x(\d+)\./);
        return hit ? Number(hit[1]) * Number(hit[2]) : Number.MAX_SAFE_INTEGER;
      };
      return size(b) - size(a);
    });
    const officialOriginals = [];
    for (const img of uniqueImages) {
      for (const candidate of originalImageCandidates(img)) {
        if (!officialOriginals.includes(candidate)) officialOriginals.push(candidate);
      }
    }
  const breadcrumb = compact((html.match(/breadcrumb[\s\S]{0,1600}/i)?.[0] || "").replace(/<[^>]+>/g, " "));
  const priceText = compact((html.match(/class="price[^"]*"[^>]*>([\s\S]{0,120})/i)?.[1] || "").replace(/<[^>]+>/g, " "));
  const mrpMatch = priceText.match(/(?:₹|Rs\.?)\s*([0-9,]+(?:\.\d+)?)/i);
  return {
    partNumber: partFromTitle,
    application: compact(compatMatch?.[1] || ""),
    oemRaw: compact((refMatch?.[1] || "").replace(/<[^>]+>/g, " ")),
    imageUrls: uniqueImages,
    officialOriginals,
    breadcrumb,
    sourcePublishedPrice: mrpMatch ? Number(mrpMatch[1].replace(/,/g, "")) : null,
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

function looksLikeImage(buffer, type) {
  if (!buffer || buffer.length < 800) return false;
  if (type && /text\/html|application\/json|text\/plain/i.test(type)) return false;
  const header = buffer.subarray(0, 16);
  const png = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  const jpeg = header[0] === 0xff && header[1] === 0xd8;
  const gif = header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46;
  const webp = header[0] === 0x52 && header[8] === 0x57;
  if (png || jpeg || gif || webp) return true;
  const asText = buffer.subarray(0, 200).toString("utf8").toLowerCase();
  return !asText.includes("<html") && !asText.includes("<!doctype");
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer[0] !== 0x89) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    const size = buffer.readUInt16BE(offset + 2);
    offset += 2 + size;
  }
  return null;
}

function linkOriginal(storePath, archivePath) {
  mkdirSync(path.dirname(archivePath), { recursive: true });
  try {
    if (existsSync(archivePath)) unlinkSync(archivePath);
    linkSync(storePath, archivePath);
  } catch {
    /* T: is small; keep the serving copy and skip a second full file. */
  }
}

async function downloadImage(urls, destBase) {
  mkdirSync(ORIGINAL_IMAGE_DIR, { recursive: true });
  mkdirSync(STORE_DIR, { recursive: true });
  for (const existingExt of [".png", ".jpeg", ".jpg", ".webp", ".gif"]) {
    const store = path.join(STORE_DIR, `${destBase}${existingExt}`);
    if (!existsSync(store)) continue;
    const st = statSync(store);
    if (st.size < 800) continue;
    const buffer = readFileSync(store);
    if (!looksLikeImage(buffer, "")) continue;
    const dims = pngDimensions(buffer) || jpegDimensions(buffer);
    linkOriginal(store, path.join(ORIGINAL_IMAGE_DIR, `${destBase}${existingExt}`));
    return {
      file: `${destBase}${existingExt}`,
      sourceUrl: urls[0] || "",
      bytes: st.size,
      width: dims?.width || null,
      height: dims?.height || null,
      watermarkProcessed: false,
      watermarkNote: "original_kept_watermark_removal_not_applied_to_avoid_product_damage",
    };
  }
  for (const url of urls) {
    try {
      const res = await fetchResponse(url, "image/*");
      if (!res.ok) continue;
      const type = (res.headers.get("content-type") || "").toLowerCase();
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!looksLikeImage(buffer, type)) continue;
      const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
      const ext =
        fromUrl === ".png" || type.includes("png")
          ? ".png"
          : fromUrl === ".webp" || type.includes("webp")
            ? ".webp"
            : fromUrl === ".gif"
              ? ".gif"
              : ".jpeg";
      const dims = pngDimensions(buffer) || jpegDimensions(buffer);
      const archive = path.join(ORIGINAL_IMAGE_DIR, `${destBase}${ext}`);
      const store = path.join(STORE_DIR, `${destBase}${ext}`);
      writeFileSync(store, buffer);
      linkOriginal(store, archive);
      return {
        file: `${destBase}${ext}`,
        sourceUrl: url,
        bytes: buffer.length,
        width: dims?.width || null,
        height: dims?.height || null,
        watermarkProcessed: false,
        watermarkNote: "original_kept_watermark_removal_not_applied_to_avoid_product_damage",
      };
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
    const joiner = startUrl.includes("?") ? "&" : "?";
    const url = `${startUrl}${joiner}page=${page}`;
    const html = await fetchText(url);
    const count = parseListing(html, meta).length;
    if (!count) break;
    const firstUrls = new Set(parseListing(htmlPages[0].html, meta).map((row) => row.sourceUrl).filter(Boolean));
    const thisUrls = parseListing(html, meta).map((row) => row.sourceUrl).filter(Boolean);
    if (thisUrls.length && thisUrls.every((item) => firstUrls.has(item))) break;
    htmlPages.push({ page, html, url });
    page += 1;
    if (page > 40) break;
  }
  const products = [];
  const discovered = { collections: new Set(), brands: new Set(), products: new Set() };
  for (const item of htmlPages) {
    products.push(...parseListing(item.html, { ...meta, listingUrl: item.url }));
    const nav = discoverNav(item.html);
    nav.collections.forEach((url) => discovered.collections.add(url));
    nav.brands.forEach((url) => discovered.brands.add(url));
    nav.products.forEach((url) => discovered.products.add(url));
  }
  return {
    pages: htmlPages.length,
    products,
    startUrl,
    html: htmlPages[0].html,
    discovered: {
      collections: [...discovered.collections],
      brands: [...discovered.brands],
      products: [...discovered.products],
    },
  };
}

function mergeProduct(target, incoming) {
  if (!target.partNumber && incoming.partNumber) target.partNumber = incoming.partNumber;
  if ((!target.sourceUrl || target.sourceUrl === `${ORIGIN}/pumpkits`) && incoming.sourceUrl && incoming.sourceUrl !== `${ORIGIN}/pumpkits`) {
    target.sourceUrl = incoming.sourceUrl;
  }
  if (incoming.listingImageUrl) target.listingImageUrls.add(incoming.listingImageUrl);
  if (incoming.listingApplication && incoming.listingApplication.length > (target.listingApplication || "").length) {
    target.listingApplication = incoming.listingApplication;
  }
  if (incoming.listingOemRaw) target.oemValues.add(incoming.listingOemRaw);
  if (incoming.category) target.categories.add(incoming.category);
  if (incoming.subcategory) target.subcategories.add(incoming.subcategory);
  if (incoming.vehicleGroup) target.vehicleGroups.add(incoming.vehicleGroup);
  if (incoming.vehicleType) target.vehicleTypes.add(incoming.vehicleType);
  if (incoming.vehicleBrand) target.vehicleBrands.add(incoming.vehicleBrand);
  if (incoming.listingUrl) target.listingUrls.add(incoming.listingUrl);
  if (incoming.recordKind) target.recordKinds.add(incoming.recordKind);
  return target;
}

function emptyMerged(row) {
  return {
    partNumber: row.partNumber,
    sourceUrl: row.sourceUrl,
    listingApplication: row.listingApplication,
    listingImageUrls: new Set(),
    oemValues: new Set(),
    categories: new Set(),
    subcategories: new Set(),
    vehicleGroups: new Set(),
    vehicleTypes: new Set(),
    vehicleBrands: new Set(),
    listingUrls: new Set(),
    recordKinds: new Set(),
  };
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

function pickCategory(categories) {
  const preferred = [
    "Automotive Water Pump Assemblies",
    "Automotive Water Pump Kits & Spares",
    "Bearing Housing Fan Assembly",
  ];
  for (const name of preferred) {
    if (categories.includes(name)) return name;
  }
  return categories[0] || "";
}

function mekoNumberParts(partNumber) {
  return String(partNumber || "")
    .split(/\s*\/\s*/)
    .map((item) => item.trim())
    .filter((item) => /^m[-\s]?\d/i.test(item));
}

function classifyExtractRow(row, duplicateCount) {
  const reasons = [...(row.reviewReasons || [])];
  const identityReasons = [];
  if (!row.partNumber) identityReasons.push("missing_part_number");
  if (row.partNumber && !/^m{1,2}[-\s]?\d/i.test(row.partNumber.trim())) {
    identityReasons.push("part_number_not_meko_prefixed");
  }
  if (!row.sourceUrl) identityReasons.push("missing_source_url");
  if (!(row.application || "").trim()) identityReasons.push("missing_compatibility");
  if (duplicateCount > 1) {
    return {
      status: "DUPLICATE",
      reviewReasons: [...reasons, ...identityReasons, "duplicate_part_number_on_official_source"],
    };
  }
  if (identityReasons.length) {
    return { status: "REVIEW", reviewReasons: [...reasons, ...identityReasons] };
  }
  if (reasons.includes("detail_fetch_failed")) {
    return { status: "REVIEW", reviewReasons: reasons };
  }
  return { status: "READY", reviewReasons: reasons };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(ORIGINAL_IMAGE_DIR, { recursive: true });
  mkdirSync(STORE_DIR, { recursive: true });

  const crawledPages = [];
  const merged = new Map();
  const failedListings = [];

  function ingest(rows) {
    for (const row of rows) {
      const key = listingIdentity(row.partNumber, row.sourceUrl);
      if (!key) continue;
      const current = merged.get(key) || emptyMerged(row);
      merged.set(key, mergeProduct(current, row));
    }
  }

  let home;
  try {
    home = await crawlListing(CATALOGUE_URL, {
      category: "Automotive Water Pump Assemblies",
      subcategory: "",
      vehicleType: "",
      vehicleBrand: "",
      recordKind: "product-card",
    });
    crawledPages.push({
      url: CATALOGUE_URL,
      pages: home.pages,
      products: home.products.length,
      kind: "catalogue-home",
    });
    ingest(home.products);
    console.log(`listing ${CATALOGUE_URL} → ${home.products.length} cards / ${home.pages} pages`);
  } catch (error) {
    failedListings.push({ url: CATALOGUE_URL, error: error instanceof Error ? error.message : "failed" });
    throw error;
  }

  const collectionUrls = new Set(home.discovered.collections);
  const brandUrls = new Set(home.discovered.brands);
  const extraProductUrls = new Set(home.discovered.products);

  const seedListings = [
    { url: `${ORIGIN}/collection/bearing-housing-fan-assembly`, category: "Bearing Housing Fan Assembly", vehicleGroup: "bearing-housing-fan-assembly", vehicleType: "Bearing Housing Fan Assembly" },
    { url: `${ORIGIN}/collection/heavy-trucks-and-buses`, category: "Automotive Water Pump Assemblies", vehicleGroup: "heavy-trucks-and-buses", vehicleType: "Heavy Trucks And Buses" },
    { url: `${ORIGIN}/collection/combine-harvesters`, category: "Automotive Water Pump Assemblies", vehicleGroup: "combine-harvesters", vehicleType: "Combine Harvesters" },
    { url: `${ORIGIN}/collection/dg-gensets`, category: "Automotive Water Pump Assemblies", vehicleGroup: "dg-gensets", vehicleType: "D.G. Gensets" },
    { url: `${ORIGIN}/collection/earthmovers`, category: "Automotive Water Pump Assemblies", vehicleGroup: "earthmovers", vehicleType: "EarthMovers" },
    { url: `${ORIGIN}/collection/light-trucks-and-buses`, category: "Automotive Water Pump Assemblies", vehicleGroup: "light-trucks-and-buses", vehicleType: "Light Trucks And Buses" },
    { url: `${ORIGIN}/collection/mini-trucks-and-passenger-vehicles`, category: "Automotive Water Pump Assemblies", vehicleGroup: "mini-trucks-and-passenger-vehicles", vehicleType: "Mini Trucks And Passenger Vehicles" },
    { url: `${ORIGIN}/collection/car`, category: "Automotive Water Pump Assemblies", vehicleGroup: "car", vehicleType: "Car" },
    { url: `${ORIGIN}/collection/tractors`, category: "Automotive Water Pump Assemblies", vehicleGroup: "tractors", vehicleType: "Tractors" },
    { url: `${ORIGIN}/collection/mini-tractors`, category: "Automotive Water Pump Assemblies", vehicleGroup: "mini-tractors", vehicleType: "Mini-Tractors" },
    { url: `${ORIGIN}/latest-development`, category: "", vehicleGroup: "", vehicleType: "" },
    { url: `${ORIGIN}/index.php?route=product/search&search=M-&limit=100`, category: "", vehicleGroup: "", vehicleType: "" },
  ];
  for (const item of seedListings) collectionUrls.add(item.url.split("?")[0].replace(/\/$/, "") === item.url ? item.url : item.url);

  const listingJobs = [];
  for (const item of seedListings) listingJobs.push(item);
  for (const url of collectionUrls) {
    if (listingJobs.some((job) => job.url === url || job.url.startsWith(`${url}?`))) continue;
    const slug = url.split("/collection/")[1] || "";
    listingJobs.push({
      url,
      category: slug === "bearing-housing-fan-assembly" ? "Bearing Housing Fan Assembly" : "Automotive Water Pump Assemblies",
      vehicleGroup: slug,
      vehicleType: slug.replace(/-/g, " "),
    });
  }
  for (const url of brandUrls) {
    const slug = decodeURIComponent(url.split("/brand/")[1] || "");
    listingJobs.push({
      url,
      category: "Automotive Water Pump Assemblies",
      vehicleGroup: "",
      vehicleType: "",
      vehicleBrand: slug.replace(/-/g, " "),
    });
  }

  for (const job of listingJobs) {
    if (job.url === CATALOGUE_URL) continue;
    try {
      const result = await crawlListing(job.url, {
        category: job.category || "",
        subcategory: job.vehicleType || "",
        vehicleType: job.vehicleType || "",
        vehicleBrand: job.vehicleBrand || "",
        vehicleGroup: job.vehicleGroup || "",
        recordKind: "product-card",
      });
      crawledPages.push({ url: job.url, pages: result.pages, products: result.products.length, kind: job.vehicleBrand ? "brand" : "listing" });
      ingest(result.products);
      result.discovered.products.forEach((url) => extraProductUrls.add(url));
      result.discovered.brands.forEach((url) => brandUrls.add(url));
      console.log(`listing ${job.url} → ${result.products.length} cards / ${result.pages} pages`);
    } catch (error) {
      failedListings.push({ url: job.url, error: error instanceof Error ? error.message : "failed" });
      console.warn(`listing failed ${job.url}: ${error instanceof Error ? error.message : error}`);
    }
  }

  try {
    const kitsHtml = await fetchText(`${ORIGIN}/pumpkits`);
    const kitRows = parseKitTables(kitsHtml);
    crawledPages.push({ url: `${ORIGIN}/pumpkits`, pages: 1, products: kitRows.length, kind: "kit-tables" });
    ingest(kitRows);
    console.log(`pumpkits tables → ${kitRows.length} rows`);
  } catch (error) {
    failedListings.push({ url: `${ORIGIN}/pumpkits`, error: error instanceof Error ? error.message : "failed" });
  }

  for (const url of extraProductUrls) {
    if (!/\/product\/[^/]*m-/i.test(url)) continue;
    const already = [...merged.values()].some((row) => row.sourceUrl === url);
    if (already) continue;
    merged.set(`url:${url.toLowerCase()}`, emptyMerged({ partNumber: "", sourceUrl: url, listingApplication: "", listingOemRaw: "" }));
  }

  const products = [...merged.values()].filter((row) => row.partNumber || row.sourceUrl);
  console.log(`unique identities before detail: ${products.length}`);

  const details = await mapLimit(products, 3, async (row, idx) => {
    const reviewReasons = [];
    let detail = {
      partNumber: row.partNumber,
      application: row.listingApplication || "",
      oemRaw: [...row.oemValues].join(", "),
      imageUrls: [...row.listingImageUrls],
      officialOriginals: [],
      breadcrumb: "",
      sourcePublishedPrice: null,
      sourceUrl: row.sourceUrl,
    };
    const canFetchDetail = row.sourceUrl && /^https:\/\/mekoautoindia\.com\/product\//i.test(row.sourceUrl);
    if (canFetchDetail) {
      try {
        const html = await fetchText(row.sourceUrl);
        detail = parseDetail(html, row.sourceUrl);
      } catch (error) {
        reviewReasons.push("detail_fetch_failed");
        detail.error = error instanceof Error ? error.message : "detail failed";
      }
    }
    const partNumber = compact(row.partNumber || detail.partNumber);
    const application = compact(detail.application || row.listingApplication || "");
    const oemSet = new Set();
    for (const value of row.oemValues) splitRefNos(value).forEach((item) => oemSet.add(item));
    splitRefNos(detail.oemRaw).forEach((item) => oemSet.add(item));
    const refNos = [...oemSet];
    const categories = [...row.categories];
    const category = pickCategory(categories);
    const subcategory = [...row.subcategories][0] || [...row.vehicleTypes][0] || "";
    const imageCandidates = [];
    for (const img of detail.officialOriginals || []) imageCandidates.push(img);
    for (const img of detail.imageUrls || []) imageCandidates.push(...originalImageCandidates(img));
    for (const img of row.listingImageUrls) imageCandidates.push(...originalImageCandidates(img));
    const uniqueCandidates = [...new Set(imageCandidates)];
    const imageKey = sanitizeImageKey(partNumber);
    let downloaded = null;
    const extraFiles = [];
    if (partNumber && uniqueCandidates.length) {
      downloaded = await downloadImage(uniqueCandidates, imageKey);
      if (!downloaded) reviewReasons.push("image_download_failed");
      else {
        const rest = uniqueCandidates.filter((url) => url !== downloaded.sourceUrl);
        let extraN = 2;
        for (const url of rest) {
          const extra = await downloadImage([url, ...originalImageCandidates(url)], `${imageKey}.${extraN}`);
          if (!extra) continue;
          extraFiles.push(extra.file);
          extraN += 1;
          if (extraN > 8) break;
        }
      }
    } else if (!uniqueCandidates.length) {
      reviewReasons.push("missing_image");
    }
    if ((idx + 1) % 20 === 0 || idx === 0) {
      console.log(`detail ${idx + 1}/${products.length} ${partNumber || row.sourceUrl}`);
    }
    const oemUnavailable = !refNos.length;
    return {
      brand: "MEKO",
      manufacturer: "Meko Auto Components Inc.",
      firm: "India Sales",
      partNumber,
      mekoPartNumbers: mekoNumberParts(partNumber),
      name: application ? `${application} (${partNumber})` : partNumber,
      description: application,
      application,
      compatibleWith: application,
      refNos,
      oem: refNos.join(" | "),
      oemUnavailable,
      category,
      subcategory,
      vehicleTypes: [...row.vehicleTypes],
      vehicleBrands: [...row.vehicleBrands],
      vehicleGroups: [...row.vehicleGroups],
      categoriesSeen: categories,
      sourceUrl: row.sourceUrl,
      listingUrls: [...row.listingUrls],
      recordKinds: [...row.recordKinds],
      officialImageUrl: downloaded?.sourceUrl || (detail.imageUrls || [])[0] || [...row.listingImageUrls][0] || "",
      officialImageUrls: uniqueCandidates,
      imageFile: downloaded?.file || "",
      galleryFiles: downloaded?.file ? [downloaded.file, ...extraFiles] : extraFiles,
      imageBytes: downloaded?.bytes || 0,
      imageWidth: downloaded?.width || null,
      imageHeight: downloaded?.height || null,
      watermarkProcessed: Boolean(downloaded?.watermarkProcessed),
      watermarkNote: downloaded?.watermarkNote || (downloaded ? "" : "no_image"),
      sourcePublishedPrice: detail.sourcePublishedPrice,
      mrp: null,
      sellingPrice: null,
      stock: 0,
      gst: null,
      hsn: null,
      specifications: {
        manufacturer: "Meko Auto Components Inc.",
        source: CATALOGUE_URL,
        source_url: row.sourceUrl,
        official_image_url: downloaded?.sourceUrl || null,
        official_image_urls: uniqueCandidates,
        catalogue_image: downloaded?.file || null,
        gallery_images: downloaded?.file ? [downloaded.file, ...extraFiles] : extraFiles,
        application,
        compatible_with: application,
        reference_nos: refNos,
        reference_no: refNos.length ? refNos.join(" | ") : null,
        oem_unavailable: oemUnavailable,
        subcategory,
        vehicle_groups: [...row.vehicleGroups],
        vehicle_types: [...row.vehicleTypes],
        vehicle_brands: [...row.vehicleBrands],
        fulfilled_by: "India Sales",
        source_published_price_ignored: detail.sourcePublishedPrice,
      },
      reviewReasons,
      error: detail.error || null,
    };
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
    for (const row of group) {
      const classified = classifyExtractRow(row, group.length);
      row.status = classified.status;
      row.reviewReasons = classified.reviewReasons;
    }
  }
  for (const row of details) {
    if (!row.status) {
      row.status = "REVIEW";
      row.reviewReasons = [...(row.reviewReasons || []), "unclassified"];
    }
  }

  const columns = [
    "status",
    "partNumber",
    "application",
    "oem",
    "category",
    "subcategory",
    "sourceUrl",
    "officialImageUrl",
    "imageFile",
    "mrp",
    "sellingPrice",
    "stock",
  ];
  const csv = [columns.join(","), ...details.map((row) => columns.map((key) => csvEscape(row[key])).join(","))].join("\n");

  const imageUrls = details.map((row) => row.officialImageUrl).filter(Boolean);
  const urlCounts = new Map();
  for (const url of imageUrls) urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
  const duplicateImageUrls = [...urlCounts.entries()].filter(([, n]) => n > 1).map(([url, count]) => ({ url, count }));

  const report = {
    source: CATALOGUE_URL,
    origin: ORIGIN,
    sourceReachable: true,
    crawledPages,
    failedListings,
    TOTAL_SOURCE_PRODUCTS: details.length,
    TOTAL_UNIQUE_MEKO_PART_NUMBERS: byPart.size,
    TOTAL_READY: details.filter((row) => row.status === "READY").length,
    TOTAL_REVIEW: details.filter((row) => row.status === "REVIEW").length,
    TOTAL_DUPLICATES: details.filter((row) => row.status === "DUPLICATE").length,
    TOTAL_CONFLICTS: 0,
    TOTAL_IMAGES: details.filter((row) => row.officialImageUrl).length,
    IMAGES_DOWNLOADED: details.filter((row) => row.imageFile).length,
    IMAGES_MISSING: details.filter((row) => !row.imageFile).length,
    IMAGES_FAILED: details.filter((row) => row.reviewReasons?.includes("image_download_failed")).length,
    duplicateImageUrls,
    productsWithMissingRefNos: details.filter((row) => !row.refNos?.length).map((row) => row.partNumber),
    productsWithMissingCompatibility: details.filter((row) => !row.application).map((row) => row.partNumber),
    productsWithMultipleRefNos: details.filter((row) => (row.refNos || []).length > 1).map((row) => ({ partNumber: row.partNumber, refNos: row.refNos })),
    productsWithMultipleMekoPartNumbers: details.filter((row) => (row.mekoPartNumbers || []).length > 1).map((row) => ({ partNumber: row.partNumber, mekoPartNumbers: row.mekoPartNumbers })),
    productsWithMissingImages: details.filter((row) => !row.imageFile).map((row) => row.partNumber),
    productsWithAmbiguousIdentity: details.filter((row) => !row.partNumber || (row.reviewReasons || []).includes("part_number_not_meko_prefixed")).map((row) => row.partNumber || row.sourceUrl),
    mrpInvented: 0,
    sourcePublishedPriceIgnoredCount: details.filter((row) => row.sourcePublishedPrice != null).length,
    generatedAt: new Date().toISOString(),
  };

  const raw = details.map((row) => ({
    partNumber: row.partNumber,
    sourceUrl: row.sourceUrl,
    listingUrls: row.listingUrls,
    recordKinds: row.recordKinds,
    application: row.application,
    refNos: row.refNos,
    category: row.category,
    subcategory: row.subcategory,
    vehicleTypes: row.vehicleTypes,
    vehicleBrands: row.vehicleBrands,
    officialImageUrl: row.officialImageUrl,
    imageFile: row.imageFile,
    status: row.status,
    reviewReasons: row.reviewReasons,
    error: row.error,
  }));

  writeFileSync(path.join(OUT_DIR, "raw-products.json"), `${JSON.stringify(raw, null, 2)}\n`);
  writeFileSync(path.join(OUT_DIR, "normalized-products.json"), `${JSON.stringify(details, null, 2)}\n`);
  writeFileSync(path.join(OUT_DIR, "import-ready.csv"), `${csv}\n`);
  writeFileSync(path.join(OUT_DIR, "extract-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(
    path.join(OUT_DIR, "image-audit.json"),
    `${JSON.stringify(
      {
        productsFound: details.length,
        imagesFound: report.TOTAL_IMAGES,
        imagesDownloaded: report.IMAGES_DOWNLOADED,
        missingImages: report.IMAGES_MISSING,
        failedDownloads: report.IMAGES_FAILED,
        duplicateImageUrls,
        processedImages: details.filter((row) => row.watermarkProcessed).length,
        rows: details.map((row) => ({
          partNumber: row.partNumber,
          imageFile: row.imageFile,
          officialImageUrl: row.officialImageUrl,
          bytes: row.imageBytes,
          width: row.imageWidth,
          height: row.imageHeight,
          watermarkProcessed: row.watermarkProcessed,
          watermarkNote: row.watermarkNote,
        })),
      },
      null,
      2,
    )}\n`,
  );
  console.log(JSON.stringify({
    TOTAL_SOURCE_PRODUCTS: report.TOTAL_SOURCE_PRODUCTS,
    TOTAL_UNIQUE_MEKO_PART_NUMBERS: report.TOTAL_UNIQUE_MEKO_PART_NUMBERS,
    TOTAL_READY: report.TOTAL_READY,
    TOTAL_REVIEW: report.TOTAL_REVIEW,
    TOTAL_DUPLICATES: report.TOTAL_DUPLICATES,
    IMAGES_DOWNLOADED: report.IMAGES_DOWNLOADED,
    IMAGES_MISSING: report.IMAGES_MISSING,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
