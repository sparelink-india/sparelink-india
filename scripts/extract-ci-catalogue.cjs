const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

const SOURCE = "https://onlineautohandles.com";
const OUT = "T:/sparelink-india/data/source-catalogue";
const IMAGE_DIR = path.join(OUT, "images");
const LIMIT = 120;
const IMAGE_CONCURRENCY = 8;
const DOWNLOAD_IMAGES = process.argv.includes("--skip-images") ? false : true;

function blank(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function parseExplicitRate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function preparedSellingPrice(rate) {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ").replaceAll('"', '""')}"`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SpareLinkIndiaCataloguePrep/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status}`);
  }
  return response.json();
}

function classify(product, skuIndex) {
  const sku = blank(product.sku);
  const name = blank(product.name);
  const status = (blank(product.statusSource) || "").toLowerCase();
  const reviewReasons = [];
  if (!sku) reviewReasons.push("missing_sku");
  if (!name) reviewReasons.push("missing_name");
  if (status && status !== "live") reviewReasons.push("status_not_live");

  const previous = sku ? skuIndex.get(sku) : null;
  if (previous) {
    const nameConflict = previous.name && name && previous.name !== name;
    const oeConflict = previous.oeCode && product.oeCode && previous.oeCode !== product.oeCode;
    if (nameConflict || oeConflict) {
      return { status: "CONFLICT", reviewReasons: ["sku_field_mismatch"] };
    }
    return { status: "DUPLICATE", reviewReasons: ["duplicate_sku"] };
  }

  if (reviewReasons.length) {
    return { status: "REVIEW", reviewReasons };
  }
  return { status: "READY", reviewReasons: [] };
}

async function extractProducts() {
  const items = [];
  let offset = 0;
  let total = null;
  let pages = 0;
  while (pages < 200) {
    const url = `${SOURCE}/api/b2b/products?offset=${offset}&limit=${LIMIT}`;
    const payload = await fetchJson(url);
    const pageItems = Array.isArray(payload.items) ? payload.items : [];
    total = Number(payload.total ?? total ?? pageItems.length);
    items.push(...pageItems);
    pages += 1;
    process.stdout.write(
      `page ${pages} offset=${offset} got=${pageItems.length} collected=${items.length} total=${total}\n`,
    );
    if (!pageItems.length || payload.hasMore === false) break;
    offset = Number(payload.offset ?? offset) + pageItems.length;
    if (items.length >= total) break;
  }
  return { items, total, pages };
}

async function downloadImage(product, urlSeen) {
  const sku = blank(product.sku);
  const imageUrl = blank(product.imageUrl);
  if (!sku || !imageUrl) {
    return {
      sku,
      sourceId: product.id || null,
      sourceImageUrl: imageUrl,
      localPath: null,
      imageStatus: imageUrl ? "skipped_unmapped" : "missing_source_url",
      duplicateStatus: "none",
    };
  }
  if (urlSeen.has(imageUrl)) {
    return {
      sku,
      sourceId: product.id || null,
      sourceImageUrl: imageUrl,
      localPath: urlSeen.get(imageUrl),
      imageStatus: "duplicate_url",
      duplicateStatus: "duplicate_url",
    };
  }
  const ext = path.extname(new URL(imageUrl).pathname).toLowerCase() || ".jpg";
  const safeSku = sku.replace(/[^A-Za-z0-9._-]+/g, "_");
  const fileName = `${safeSku}${ext}`;
  const localPath = path.join(IMAGE_DIR, fileName);
  const relative = `data/source-catalogue/images/${fileName}`;
  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "SpareLinkIndiaCataloguePrep/1.0" },
    });
    if (!response.ok || !response.body) {
      return {
        sku,
        sourceId: product.id || null,
        sourceImageUrl: imageUrl,
        localPath: null,
        imageStatus: `http_${response.status}`,
        duplicateStatus: "none",
      };
    }
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(localPath));
    urlSeen.set(imageUrl, relative);
    return {
      sku,
      sourceId: product.id || null,
      sourceImageUrl: imageUrl,
      localPath: relative,
      imageStatus: "downloaded",
      duplicateStatus: "original",
    };
  } catch (error) {
    return {
      sku,
      sourceId: product.id || null,
      sourceImageUrl: imageUrl,
      localPath: null,
      imageStatus: "download_error",
      duplicateStatus: "none",
      error: error instanceof Error ? error.message : "download_error",
    };
  }
}

async function downloadImages(products) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const urlSeen = new Map();
  const manifest = [];
  let i = 0;
  async function worker() {
    while (i < products.length) {
      const index = i;
      i += 1;
      manifest[index] = await downloadImage(products[index], urlSeen);
      if ((index + 1) % 200 === 0) {
        process.stdout.write(`images ${index + 1}/${products.length}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, () => worker()));
  return manifest;
}

function writeCsv(file, headers, rows) {
  const body = rows.map((row) => headers.map((key) => csvCell(row[key])).join(","));
  fs.writeFileSync(file, `${headers.join(",")}\n${body.join("\n")}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const categories = await fetchJson(`${SOURCE}/api/b2b/categories`);
  const categoryList = Array.isArray(categories) ? categories : [];
  const { items, total, pages } = await extractProducts();

  const skuIndex = new Map();
  const products = [];
  const duplicates = [];
  const conflicts = [];
  for (const raw of items) {
    const product = {
      sourceId: blank(raw.id),
      sku: blank(raw.sku),
      barcode: blank(raw.barcode),
      name: blank(raw.name),
      manufacturer: blank(raw.manufacturer),
      brand: blank(raw.manufacturer),
      categoryId: blank(raw.categoryId),
      categoryName: blank(raw.categoryName),
      categoryIds: Array.isArray(raw.categoryIds) ? raw.categoryIds : [],
      categoryNames: Array.isArray(raw.categoryNames) ? raw.categoryNames : [],
      vehicleTypes: Array.isArray(raw.vehicleTypes) ? raw.vehicleTypes : [],
      uom: blank(raw.uom),
      statusSource: blank(raw.status),
      hsn: blank(raw.hsn) && blank(raw.hsn) !== "-" ? blank(raw.hsn) : null,
      oeCode: blank(raw.oeCode),
      moq: Number.isFinite(Number(raw.moq)) && String(raw.moq ?? "").trim() !== "" ? Number(raw.moq) : null,
      sourcePrice: parseExplicitRate(raw.price),
      sourcePreviousPrice: parseExplicitRate(raw.previousPrice),
      gst: Number.isFinite(Number(raw.gst)) ? Number(raw.gst) : null,
      description: blank(raw.description),
      imageUrl: blank(raw.imageUrl),
      sourceUrl: `${SOURCE}/b2b`,
      sourcePage: `${SOURCE}/api/b2b/products`,
      firmAssignment: null,
    };
    const result = classify(product, skuIndex);
    product.validationStatus = result.status;
    product.reviewReasons = result.reviewReasons;
    if (result.status === "DUPLICATE") duplicates.push(product);
    else if (result.status === "CONFLICT") conflicts.push(product);
    else {
      if (product.sku) {
        skuIndex.set(product.sku, { name: product.name, oeCode: product.oeCode });
      }
      products.push(product);
    }
  }

  const uniqueProducts = products;
  let imageManifest = uniqueProducts.map((product) => ({
    sku: product.sku,
    sourceId: product.sourceId,
    sourceImageUrl: product.imageUrl,
    localPath: null,
    imageStatus: product.imageUrl ? "pending" : "missing_source_url",
    duplicateStatus: "none",
  }));
  if (DOWNLOAD_IMAGES) {
    imageManifest = await downloadImages(uniqueProducts);
  }
  const imageBySku = new Map(imageManifest.map((row) => [row.sku, row]));
  for (const product of uniqueProducts) {
    const image = imageBySku.get(product.sku);
    product.localImagePath = image?.localPath || null;
    product.imageStatus = image?.imageStatus || "missing_source_url";
    if (product.validationStatus === "READY" && image && image.imageStatus.startsWith("http_")) {
      product.validationStatus = "REVIEW";
      product.reviewReasons = [...product.reviewReasons, "image_download_failed"];
    }
  }

  const ready = uniqueProducts.filter((p) => p.validationStatus === "READY");
  const review = uniqueProducts.filter((p) => p.validationStatus === "REVIEW");
  const counts = {
    sourceTotalClaimed: total,
    pagesFetched: pages,
    rawRecords: items.length,
    uniqueProducts: uniqueProducts.length,
    READY: ready.length,
    REVIEW: review.length,
    DUPLICATE: duplicates.length,
    CONFLICT: conflicts.length,
    imagesDiscovered: uniqueProducts.filter((p) => p.imageUrl).length,
    imagesDownloaded: imageManifest.filter((row) => row.imageStatus === "downloaded").length,
    imagesDuplicateUrl: imageManifest.filter((row) => row.duplicateStatus === "duplicate_url").length,
    imagesMissing: imageManifest.filter((row) => row.imageStatus === "missing_source_url").length,
    imagesFailed: imageManifest.filter((row) =>
      ["download_error"].includes(row.imageStatus) || String(row.imageStatus).startsWith("http_"),
    ).length,
    imported: 0,
    categories: categoryList.length,
  };

  const coverage = {
    source: `${SOURCE}/b2b`,
    api: `${SOURCE}/api/b2b/products`,
    categoriesApi: `${SOURCE}/api/b2b/categories`,
    claimedTotal: total,
    extractedRaw: items.length,
    extractedUnique: uniqueProducts.length,
    categoryCount: categoryList.length,
    categories: categoryList,
    remaining: total == null ? "unknown" : Math.max(0, Number(total) - items.length),
    notes: [
      "Enumerated via public GET /api/b2b/products pagination (offset/limit).",
      "Source UI category dropdown showed All Categories (8182).",
      "Source API items[].price stored as sourcePrice/source_rate; copied to selling_price only when explicit and > 0.",
      "previousPrice is provenance only and is not treated as MRP.",
      "Firm assignment left null for admin.",
      "Not imported to SpareLink database.",
    ],
  };

  const importReadyHeaders = [
    "part_number",
    "part_name",
    "description",
    "brand",
    "category",
    "sku",
    "hsn",
    "gst",
    "moq",
    "uom",
    "source_rate",
    "mrp",
    "selling_price",
    "oem_number",
    "vehicle_make",
    "source_url",
    "source_image_url",
    "validation_status",
    "firm",
  ];
  const importReadyRows = ready.map((p) => ({
    part_number: p.sku,
    part_name: p.name,
    description: p.description || "",
    brand: p.brand || "",
    category: p.categoryName || "",
    sku: p.sku,
    hsn: p.hsn || "",
    gst: p.gst ?? "",
    moq: p.moq ?? "",
    uom: p.uom || "",
    source_rate: p.sourcePrice ?? "",
    mrp: "",
    selling_price: preparedSellingPrice(p.sourcePrice) ?? "",
    oem_number: p.oeCode || "",
    vehicle_make: (p.vehicleTypes || []).join("; "),
    source_url: p.sourceUrl,
    source_image_url: p.imageUrl || "",
    validation_status: p.validationStatus,
    firm: "",
  }));

  fs.writeFileSync(path.join(OUT, "full-catalogue.json"), JSON.stringify(uniqueProducts, null, 2));
  fs.writeFileSync(path.join(OUT, "image-manifest.json"), JSON.stringify(imageManifest, null, 2));
  fs.writeFileSync(path.join(OUT, "duplicate-report.json"), JSON.stringify(duplicates, null, 2));
  fs.writeFileSync(path.join(OUT, "conflict-report.json"), JSON.stringify(conflicts, null, 2));
  fs.writeFileSync(path.join(OUT, "coverage-report.json"), JSON.stringify(coverage, null, 2));
  fs.writeFileSync(
    path.join(OUT, "validation-report.json"),
    JSON.stringify(
      {
        extractedAt: new Date().toISOString(),
        source: `${SOURCE}/b2b`,
        counts,
        reviewReasonCounts: review.reduce((acc, row) => {
          for (const reason of row.reviewReasons) acc[reason] = (acc[reason] || 0) + 1;
          return acc;
        }, {}),
        notes: coverage.notes,
      },
      null,
      2,
    ),
  );
  writeCsv(
    path.join(OUT, "full-catalogue.csv"),
    [
      "sourceId",
      "sku",
      "name",
      "brand",
      "categoryName",
      "oeCode",
      "hsn",
      "gst",
      "moq",
      "uom",
      "sourcePrice",
      "source_rate",
      "mrp",
      "selling_price",
      "statusSource",
      "vehicleTypes",
      "imageUrl",
      "localImagePath",
      "imageStatus",
      "validationStatus",
      "sourceUrl",
      "firm",
    ],
    uniqueProducts.map((p) => ({
      ...p,
      vehicleTypes: (p.vehicleTypes || []).join("; "),
      source_rate: p.sourcePrice ?? "",
      mrp: "",
      selling_price: preparedSellingPrice(p.sourcePrice) ?? "",
      firm: "",
    })),
  );
  writeCsv(path.join(OUT, "import-ready.csv"), importReadyHeaders, importReadyRows);
  fs.writeFileSync(
    path.join(OUT, "typesense-index-plan.json"),
    JSON.stringify(
      {
        status: "prepared_not_indexed",
        productionReindex: false,
        fields: [
          "name",
          "part_number",
          "oem_number",
          "brand",
          "category",
          "vehicle_make",
          "vehicle_model",
          "variant",
          "compatibility",
        ],
        note: "Do not run scripts/index-parts.ts against Production. Index only after admin import into an approved database.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
