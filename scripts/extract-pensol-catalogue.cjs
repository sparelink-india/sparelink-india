const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const SOURCE_ORIGIN = "https://pensol.com";
const OUT = path.join(process.cwd(), "data", "pensol-catalogue");
const IMAGE_DIR = path.join(OUT, "images");
const USER_AGENT = "SpareLinkIndiaPensolExtract/1.0";
const DOWNLOAD_IMAGES = !process.argv.includes("--skip-images");
const FETCH_CONCURRENCY = 4;
const IMAGE_CONCURRENCY = 6;

const BRAND = "Pensol";
const MANUFACTURER = "PENSOL INDUSTRIES LIMITED";
const FULFILLED_BY = "Hind Motors";

const AUTOMOTIVE_CATEGORIES = [
  "MOTORBIKE_OILS.html",
  "PASSENGER_CAR_ENGINE_OILS.html",
  "MINI_CV_ENGINE_OIL.html",
  "DIESEL_ENGINE_OILS.html",
  "GEAR_OILS.html",
  "CNG_ENGINE_OILS.html",
  "AGRICULTURE_&_TRACTOR_OILS.html",
  "GREASES.html",
  "BRAKE_FLUID.html",
  "COOLANTS.html",
  "HYDRAULIC_OIL.html",
  "DIESEL_EXHAUST_FLUID.html",
];

const INDUSTRIAL_CATEGORIES = [
  "INDUSTRIAL.html",
  "INDUSTRIAL_HYDRAULIC_OIL.html",
  "INDUSTRIAL_GEAR_OIL.html",
  "COMPRESSOR_OIL.html",
  "REFRIGERATION_OIL.html",
  "CIRCULATING_OIL.html",
  "INDUSTRIAL_GREASES.html",
  "METAL_WORKING_FLUID.html",
  "QUENCHING_OIL.html",
  "THERMIC_FLUID.html",
  "SPECIAL_GRADE_MACHINERY_OIL.html",
  "RUST_PREVENTIVE_OIL.html",
  "ROCK_DRILL_OIL.html",
  "INDUSTRIAL_DIESEL_ENGINE_OIL.html",
  "AXLE_&_TRANSMISSION_OIL.html",
  "SPINNING_OIL.html",
  "OTHERS.html",
];

const CORPORATE_PAGES = new Set(
  [
    "index.php",
    "overview.html",
    "vision_mission_values.html",
    "leadership.html",
    "awards_&_milestones.html",
    "our_clients.html",
    "oem_approvals.html",
    "quality_assurance.html",
    "csr.html",
    "our_network.html",
    "ad_campaigns_news_update.html",
    "product_launch_updates.html",
    "events.html",
    "channel_partnership.html",
    "oem.html",
    "sponsorship_media.html",
    "international_licensing.html",
    "career.html",
    "contact.html",
    "MOTORBIKES.html",
    "3_WHEELERS.html",
    "PASSENGER_CARS.html",
    "COMMERCIAL_VEHICLES.html",
    "TRACTORS.html",
  ].map((item) => item.toLowerCase()),
);

const SKIP_IMAGE = /(favicon|logo|menu\/|compubrain|preloader|font-awesome)/i;

function blank(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length ? text : "";
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ").replaceAll('"', '""')}"`;
}

function writeCsv(file, headers, rows) {
  const body = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => csvCell(row[key] ?? "")).join(",")),
  ].join("\n");
  fs.writeFileSync(file, `${body}\n`, "utf8");
}

function absoluteUrl(href) {
  const raw = blank(href);
  if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:")) {
    return null;
  }
  try {
    return new URL(raw, `${SOURCE_ORIGIN}/`).href;
  } catch {
    return null;
  }
}

function pageSlug(url) {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(path.posix.basename(parsed.pathname));
    return name.toLowerCase();
  } catch {
    return "";
  }
}

function stripComments(html) {
  return String(html).replace(/<!--[\s\S]*?-->/g, "");
}

function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textOf(html) {
  return decodeEntities(
    String(html)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|li|div|h\d)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  const html = await response.text();
  return { ok: response.ok, status: response.status, html, url: response.url || url };
}

function extractMain(html) {
  const match = String(html).match(/<main[\s\S]*?<\/main>/i);
  return match ? match[0] : html;
}

function firstMatch(html, regex) {
  const match = regex.exec(html);
  return match ? decodeEntities(textOf(match[1])) : "";
}

function collectHrefs(html) {
  const hrefs = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html))) {
    hrefs.push(match[1]);
  }
  return hrefs;
}

function isPensolHtmlPage(url) {
  if (!url || !url.startsWith(SOURCE_ORIGIN)) return false;
  const slug = pageSlug(url);
  if (!slug) return false;
  if (CORPORATE_PAGES.has(slug)) return false;
  return slug.endsWith(".html") || slug === "index.php";
}

function parseSpecBlocks(sectionHtml) {
  const specs = {};
  const regex =
    /<div class="product-detail-group-specification-title">\s*([^<]+?)\s*<\/div>\s*(?:<div class="product-detail-group-specification-value">)?\s*(?:<ul class="ul-list">([\s\S]*?)<\/ul>|(<p[\s\S]*?<\/p>))/gi;
  let match;
  while ((match = regex.exec(sectionHtml))) {
    const title = blank(textOf(match[1]));
    const value = blank(textOf(match[2] || match[3] || ""));
    if (!title || !value) continue;
    const key = title.toLowerCase();
    specs[key] = specs[key] ? `${specs[key]} | ${value}` : value;
  }
  return specs;
}

function parsePacks(packText) {
  const source = blank(packText);
  if (!source) return [];
  const packs = [];
  const regex =
    /(\d+(?:\.\d+)?)\s*(ml|ltr|litres|litre|liters|liter|kg|gms|gm|g|l)\b(?:\s*\(([^)/]+)\))?/gi;
  let match;
  while ((match = regex.exec(source))) {
    const quantity = match[1];
    const rawUom = match[2];
    const note = blank(match[3]);
    const uomLower = rawUom.toLowerCase();
    let packUom = rawUom;
    if (uomLower === "l") packUom = "L";
    else if (["ltr", "litre", "litres", "liter", "liters"].includes(uomLower)) packUom = rawUom;
    else if (uomLower === "ml") packUom = "ml";
    else if (uomLower === "kg") packUom = "KG";
    else if (["g", "gm", "gms"].includes(uomLower)) packUom = rawUom;
    const display = note ? `${quantity} ${packUom} (${note})` : `${quantity} ${packUom}`;
    packs.push({
      pack_quantity: quantity,
      pack_uom: packUom,
      pack_size: display,
      pack_note: note,
    });
  }
  return packs;
}

function classifySegment(categoryFile) {
  const slug = String(categoryFile || "").toLowerCase();
  if (INDUSTRIAL_CATEGORIES.some((item) => item.toLowerCase() === slug)) return "Industrial";
  if (AUTOMOTIVE_CATEGORIES.some((item) => item.toLowerCase() === slug)) return "Automotive";
  if (slug.includes("industrial")) return "Industrial";
  return "Automotive";
}

function parseBreadcrumbs(html) {
  const items = [];
  const regex = /<a class="breadcrumb-link" href="([^"]+)">([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const href = blank(match[1]);
    const label = blank(textOf(match[2]));
    if (!href || /index\.php/i.test(href) || /^home$/i.test(label)) continue;
    items.push({ href, label, file: path.posix.basename(href.split("?")[0]) });
  }
  return items;
}

function looksLikeCategoryListing(mainHtml) {
  const technologyCards = (mainHtml.match(/<li class="technology"/gi) || []).length;
  if (technologyCards >= 2) return true;
  const groupLinks = (mainHtml.match(/id="product-detail-group"[\s\S]*?<a href="[^"]+\.html"/i) || [])
    .length;
  const packSize = /specification-title">\s*Pack Size/i.test(mainHtml);
  const application = /product-detail-group-title">\s*Application/i.test(mainHtml);
  const productImg = /class="product_img"/i.test(mainHtml);
  if (!packSize && !application && !productImg && /id="product-detail-group"/i.test(mainHtml)) {
    const childLinks = collectHrefs(mainHtml.match(/id="product-detail-group"[\s\S]*?<\/ul>/i)?.[0] || "")
      .filter((href) => /\.html$/i.test(href) && !href.startsWith("http"));
    if (childLinks.length >= 3) return true;
  }
  return Boolean(groupLinks && !packSize && !application && !productImg);
}

function extractProductFromHtml(url, html, categoryFile, categoryTitle) {
  const main = stripComments(extractMain(html));
  const title = firstMatch(html, /<h1 class="products-subcategory-title">([\s\S]*?)<\/h1>/i);
  const crumbs = parseBreadcrumbs(html);
  const categoryCrumb = crumbs[0];
  const resolvedCategoryFile = categoryCrumb?.file || categoryFile;
  const resolvedCategoryTitle =
    categoryCrumb?.label ||
    categoryTitle ||
    blank(String(categoryFile || "").replace(/\.html$/i, "").replaceAll("_", " "));
  const specs = parseSpecBlocks(main);
  const description =
    firstMatch(main, /<div class="products-subcategory-description">([\s\S]*?)<\/div>/i) ||
    firstMatch(main, /<div class="product_info">[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const application =
    firstMatch(
      main,
      /<h4 class="product-detail-group-title">\s*Application\s*<\/h4>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
    ) || specs.application || "";
  const advantages = firstMatch(
    main,
    /specification-title">\s*Advantages\s*<\/div>[\s\S]*?<ul class="ul-list">([\s\S]*?)<\/ul>/i,
  );
  const imageRel =
    firstMatch(main, /<div class="product_img">[\s\S]*?<img[^>]+src="([^"]+)"/i) ||
    firstMatch(main, /<div class="product-detail-group-image"[^>]*>\s*<img[^>]+src="([^"]+)"/i);
  const imageUrl = imageRel && !SKIP_IMAGE.test(imageRel) ? absoluteUrl(imageRel) : "";
  const packSource = specs["pack size"] || specs.packsize || "";
  const viscosity = specs["viscosity grade"] || specs.viscosity || "";
  const specification = specs.specification || specs.specifications || "";
  const productCode =
    specs["product code"] ||
    specs.sku ||
    specs["part number"] ||
    specs["part no"] ||
    specs.model ||
    "";

  const specParts = [];
  if (viscosity) specParts.push(`Viscosity Grade: ${viscosity}`);
  if (specification) specParts.push(`Specification: ${specification}`);
  if (advantages) specParts.push(`Advantages: ${advantages}`);
  for (const [key, value] of Object.entries(specs)) {
    if (["pack size", "packsize", "application", "viscosity grade", "viscosity", "specification", "specifications", "product code", "sku", "part number", "part no", "model"].includes(key)) {
      continue;
    }
    specParts.push(`${key}: ${value}`);
  }

  const isListing = looksLikeCategoryListing(main);
  const isProduct = Boolean(
    title &&
      !isListing &&
      (packSource || application || /class="product_img"/i.test(main) || /product-detail-group-title">\s*Application/i.test(main)),
  );

  return {
    source_product_url: url,
    product_name: title,
    brand: BRAND,
    manufacturer: MANUFACTURER,
    fulfilled_by: FULFILLED_BY,
    category: resolvedCategoryTitle,
    subcategory: title,
    segment: classifySegment(resolvedCategoryFile),
    product_code: productCode,
    pack_size_source: packSource,
    viscosity_grade: viscosity,
    specification,
    specifications: specParts.join(" | "),
    application,
    description,
    source_image_url: imageUrl || "",
    isListing,
    isProduct,
    childHrefs: collectProductHrefs(main),
  };
}

function collectProductHrefs(mainHtml) {
  const hrefs = new Set();
  const tech = /<li class="technology"[^>]*>[\s\S]*?<a href="([^"]+)"/gi;
  let match;
  while ((match = tech.exec(mainHtml))) hrefs.add(match[1]);
  const group = mainHtml.match(/id="product-detail-group"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i)?.[0] || "";
  for (const href of collectHrefs(group)) {
    if (/\.html$/i.test(href) && !href.startsWith("http") && !href.includes("/")) hrefs.add(href);
  }
  return [...hrefs];
}

function collectCategoryHrefs(html) {
  const main = extractMain(html);
  const hrefs = new Set();
  for (const href of collectHrefs(main)) {
    if (!/\.html$/i.test(href)) continue;
    if (href.startsWith("http") && !href.includes("pensol.com")) continue;
    const file = href.split("/").pop();
    if (file && !CORPORATE_PAGES.has(file.toLowerCase())) hrefs.add(file);
  }
  return [...hrefs];
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function safeImageName(url, slug) {
  let ext = ".jpg";
  try {
    ext = path.extname(new URL(url).pathname).toLowerCase() || ".jpg";
  } catch {
    ext = ".jpg";
  }
  if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) ext = ".jpg";
  const base = String(slug || "pensol")
    .replace(/\.html$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(0, 80);
  return `${base}${ext}`;
}

async function downloadImage(sourceUrl, localName, urlSeen) {
  if (!sourceUrl) {
    return {
      sourceUrl: "",
      localFilename: "",
      localPath: "",
      httpStatus: null,
      checksum: "",
      imageStatus: "missing_source_url",
    };
  }
  if (urlSeen.has(sourceUrl)) {
    const previous = urlSeen.get(sourceUrl);
    return { ...previous, imageStatus: "duplicate_url" };
  }
  const fileName = localName;
  const localPath = path.join(IMAGE_DIR, fileName);
  const relative = `data/pensol-catalogue/images/${fileName}`;
  try {
    const response = await fetch(sourceUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok || !response.body) {
      const result = {
        sourceUrl,
        localFilename: "",
        localPath: "",
        httpStatus: response.status,
        checksum: "",
        imageStatus: `http_${response.status}`,
      };
      return result;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    fs.writeFileSync(localPath, buffer);
    const result = {
      sourceUrl,
      localFilename: fileName,
      localPath: relative,
      httpStatus: response.status,
      checksum,
      imageStatus: "downloaded",
    };
    urlSeen.set(sourceUrl, result);
    return result;
  } catch (error) {
    return {
      sourceUrl,
      localFilename: "",
      localPath: "",
      httpStatus: null,
      checksum: "",
      imageStatus: "download_error",
      error: error instanceof Error ? error.message : "download_error",
    };
  }
}

function uomBucket(uom) {
  const value = String(uom || "").toLowerCase();
  if (["kg", "g", "gm", "gms"].includes(value)) return "KG";
  if (["l", "ltr", "litre", "litres", "liter", "liters", "ml"].includes(value)) return "LTR/L";
  if (!value) return "blank";
  return "PCS/other";
}

async function main() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  for (const leftover of ["_raw-home.html", "_raw-4st-sn.html"]) {
    const file = path.join(OUT, leftover);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  const queue = [...new Set([...AUTOMOTIVE_CATEGORIES, ...INDUSTRIAL_CATEGORIES])];
  const seenPages = new Set();
  const categoryFiles = new Set(queue);
  const pageCache = new Map();
  const productsByUrl = new Map();
  const discoveredCategories = [];

  process.stdout.write("Crawling official Pensol category/product pages...\n");

  while (queue.length) {
    const batch = [];
    while (queue.length && batch.length < FETCH_CONCURRENCY) {
      const file = queue.shift();
      const url = absoluteUrl(file);
      const key = url.toLowerCase();
      if (!url || seenPages.has(key) || CORPORATE_PAGES.has(pageSlug(url))) continue;
      seenPages.add(key);
      batch.push({ file, url });
    }
    if (!batch.length) continue;
    const pages = await mapPool(batch, FETCH_CONCURRENCY, async (item) => {
      const fetched = await fetchText(item.url);
      return { ...item, ...fetched };
    });
    for (const page of pages) {
      pageCache.set(page.url, page);
      if (!page.ok) {
        process.stdout.write(`skip ${page.file} HTTP ${page.status}\n`);
        continue;
      }
      const categoryTitle = firstMatch(page.html, /<h1 class="products-subcategory-title">([\s\S]*?)<\/h1>/i);
      const extracted = extractProductFromHtml(page.url, page.html, page.file, categoryTitle);
      if (extracted.isProduct) {
        const existing = productsByUrl.get(page.url);
        if (!existing) {
          productsByUrl.set(page.url, extracted);
        } else if (existing.category !== extracted.category) {
          existing.category = `${existing.category} | ${extracted.category}`;
        }
      } else {
        discoveredCategories.push({
          file: page.file,
          url: page.url,
          title: categoryTitle || page.file,
          segment: classifySegment(page.file),
        });
        categoryFiles.add(page.file);
        for (const href of new Set([...extracted.childHrefs, ...collectCategoryHrefs(page.html)])) {
          const childUrl = absoluteUrl(href);
          if (!isPensolHtmlPage(childUrl)) continue;
          const slug = pageSlug(childUrl);
          if (!seenPages.has(childUrl.toLowerCase()) && !CORPORATE_PAGES.has(slug)) {
            queue.push(path.posix.basename(new URL(childUrl).pathname));
          }
        }
      }
    }
    process.stdout.write(
      `pages=${seenPages.size} products=${productsByUrl.size} queue=${queue.length}\n`,
    );
  }

  const uniqueProducts = [...productsByUrl.values()];
  const urlSeenImages = new Map();
  const imageManifest = [];

  if (DOWNLOAD_IMAGES) {
    process.stdout.write(`Downloading ${uniqueProducts.length} official product images...\n`);
    const downloads = await mapPool(uniqueProducts, IMAGE_CONCURRENCY, async (product) => {
      const slug = pageSlug(product.source_product_url);
      const image = await downloadImage(
        product.source_image_url,
        safeImageName(product.source_image_url, slug),
        urlSeenImages,
      );
      return {
        source_product_url: product.source_product_url,
        product_name: product.product_name,
        sourceUrl: image.sourceUrl || product.source_image_url,
        localFilename: image.localFilename,
        localPath: image.localPath,
        httpStatus: image.httpStatus,
        checksum: image.checksum,
        imageStatus: image.imageStatus,
        error: image.error || "",
      };
    });
    imageManifest.push(...downloads);
    const byUrl = new Map(downloads.map((row) => [row.source_product_url, row]));
    for (const product of uniqueProducts) {
      const image = byUrl.get(product.source_product_url);
      product.local_image_path = image?.localPath || "";
      product.image_http_status = image?.httpStatus ?? "";
      product.image_checksum = image?.checksum || "";
      product.image_status = image?.imageStatus || "missing_source_url";
    }
  } else {
    for (const product of uniqueProducts) {
      product.image_status = product.source_image_url ? "skipped" : "missing_source_url";
      imageManifest.push({
        source_product_url: product.source_product_url,
        product_name: product.product_name,
        sourceUrl: product.source_image_url,
        localFilename: "",
        localPath: "",
        httpStatus: null,
        checksum: "",
        imageStatus: product.image_status,
      });
    }
  }

  const records = [];
  const duplicates = [];
  const conflicts = [];
  const reviews = [];
  let variantRows = 0;

  for (const product of uniqueProducts) {
    const reviewReasons = [];
    if (!product.product_name) reviewReasons.push("missing_product_name");
    if (!product.source_product_url) reviewReasons.push("missing_source_url");
    if (!product.source_image_url) reviewReasons.push("missing_image");
    if (product.image_status && String(product.image_status).startsWith("http_")) {
      reviewReasons.push("image_download_failed");
    }
    const packs = parsePacks(product.pack_size_source);
    if (product.pack_size_source && packs.length === 0) reviewReasons.push("ambiguous_pack_uom");
    if (!product.pack_size_source) reviewReasons.push("pack_size_not_stated");

    const validationStatus = reviewReasons.length ? "REVIEW" : "READY";
    const priceFlags = [];
    if (true) priceFlags.push("mrp_not_stated_on_official_site");
    priceFlags.push("dlp_not_stated_on_official_site");

    const variants = packs.length ? packs : [{ pack_quantity: "", pack_uom: "", pack_size: product.pack_size_source, pack_note: "" }];
    if (packs.length > 1) variantRows += packs.length - 1;

    variants.forEach((pack, index) => {
      const record = {
        record_id: `${pageSlug(product.source_product_url).replace(/\.html$/i, "")}${packs.length ? `-${index + 1}` : ""}`,
        product_name: product.product_name,
        brand: BRAND,
        manufacturer: MANUFACTURER,
        fulfilled_by: FULFILLED_BY,
        category: product.category,
        subcategory: product.subcategory,
        segment: product.segment,
        product_code: product.product_code,
        pack_quantity: pack.pack_quantity,
        pack_uom: pack.pack_uom,
        pack_size: pack.pack_size,
        pack_size_source: product.pack_size_source,
        pack_note: pack.pack_note,
        mrp: "",
        dlp_price_inclusive_tax: "",
        viscosity_grade: product.viscosity_grade,
        specification: product.specification,
        specifications: product.specifications,
        application: product.application,
        description: product.description,
        source_product_url: product.source_product_url,
        source_image_url: product.source_image_url,
        local_image_path: product.local_image_path || "",
        image_status: product.image_status || "",
        validation_status: validationStatus,
        review_reasons: reviewReasons.join("|"),
        price_flags: priceFlags.join("|"),
        variant_index: packs.length ? index + 1 : "",
        variant_count: packs.length || "",
      };
      records.push(record);
      if (validationStatus === "REVIEW") reviews.push(record);
    });
  }

  const importHeaders = [
    "product_name",
    "brand",
    "manufacturer",
    "fulfilled_by",
    "category",
    "subcategory",
    "product_code",
    "pack_quantity",
    "pack_uom",
    "pack_size",
    "mrp",
    "dlp_price_inclusive_tax",
    "specifications",
    "application",
    "description",
    "source_product_url",
    "source_image_url",
  ];

  const fullHeaders = [
    ...importHeaders,
    "segment",
    "pack_size_source",
    "pack_note",
    "viscosity_grade",
    "specification",
    "local_image_path",
    "image_status",
    "validation_status",
    "review_reasons",
    "price_flags",
    "variant_index",
    "variant_count",
    "record_id",
  ];

  const importReady = records.filter((row) => row.validation_status === "READY" || row.product_name && row.source_product_url);
  const uniqueUrls = new Set(records.map((row) => row.source_product_url));
  const automotive = records.filter((row) => row.segment === "Automotive");
  const industrial = records.filter((row) => row.segment === "Industrial");
  const uomCounts = { KG: 0, "LTR/L": 0, "PCS/other": 0, blank: 0, Ambiguous: 0 };
  for (const row of records) {
    if (String(row.review_reasons).includes("ambiguous_pack_uom")) uomCounts.Ambiguous += 1;
    uomCounts[uomBucket(row.pack_uom)] += 1;
  }

  const coverage = {
    officialSource: SOURCE_ORIGIN,
    crawlPages: seenPages.size,
    categoriesDiscovered: discoveredCategories,
    categoryCount: discoveredCategories.length,
    productPages: uniqueProducts.length,
    notes: [
      "Extracted only from https://pensol.com/",
      "No MRP or DLP was present on official product pages; both left blank.",
      "No product code/SKU field was present on official pages; product_code left blank.",
      "Pack variants split only from explicit Pack Size lists on the product page.",
      "Viscosity grades were stored as specifications, not as invented SKUs.",
      "No database import performed.",
    ],
  };

  const totals = {
    totalProductRecords: records.length,
    uniqueProducts: uniqueUrls.size,
    packVariants: records.length,
    extraPackVariantRows: variantRows,
    automotiveRecords: automotive.length,
    industrialRecords: industrial.length,
    productCategories: new Set(records.map((row) => row.category)).size,
    recordsWithMrp: records.filter((row) => blank(row.mrp)).length,
    recordsWithDlp: records.filter((row) => blank(row.dlp_price_inclusive_tax)).length,
    recordsWithoutMrp: records.filter((row) => !blank(row.mrp)).length,
    recordsWithoutDlp: records.filter((row) => !blank(row.dlp_price_inclusive_tax)).length,
    imagesFound: uniqueProducts.filter((row) => row.source_image_url).length,
    imagesDownloaded: imageManifest.filter((row) => row.imageStatus === "downloaded").length,
    imageFailures: imageManifest.filter(
      (row) => row.imageStatus === "download_error" || String(row.imageStatus).startsWith("http_"),
    ).length,
    imagesMissing: imageManifest.filter((row) => row.imageStatus === "missing_source_url").length,
    duplicateImageUrls: imageManifest.filter((row) => row.imageStatus === "duplicate_url").length,
    REVIEW: reviews.length,
    DUPLICATE: duplicates.length,
    CONFLICT: conflicts.length,
    READY: records.filter((row) => row.validation_status === "READY").length,
    inventedSku: 0,
    inventedMrp: 0,
    inventedDlp: 0,
    uomCounts,
  };

  writeCsv(path.join(OUT, "full-catalogue.csv"), fullHeaders, records);
  writeCsv(path.join(OUT, "import-ready.csv"), importHeaders, importReady);
  fs.writeFileSync(path.join(OUT, "full-catalogue.json"), JSON.stringify(records, null, 2));
  fs.writeFileSync(path.join(OUT, "image-manifest.json"), JSON.stringify(imageManifest, null, 2));
  fs.writeFileSync(
    path.join(OUT, "validation-report.json"),
    JSON.stringify({ totals, reviewSample: reviews.slice(0, 50) }, null, 2),
  );
  fs.writeFileSync(path.join(OUT, "duplicate-report.json"), JSON.stringify(duplicates, null, 2));
  fs.writeFileSync(path.join(OUT, "conflict-report.json"), JSON.stringify(conflicts, null, 2));
  fs.writeFileSync(path.join(OUT, "coverage-report.json"), JSON.stringify({ ...coverage, totals }, null, 2));

  process.stdout.write("\n=== PENSOL EXTRACTION TOTALS ===\n");
  process.stdout.write(JSON.stringify(totals, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
