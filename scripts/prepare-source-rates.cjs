const fs = require("fs");
const path = require("path");

const SOURCE = "https://onlineautohandles.com";
const OUT = path.join("data", "source-catalogue");
const FULL_JSON = path.join(OUT, "full-catalogue.json");
const LIMIT = 120;

function csvCell(value) {
  return `"${String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ").replaceAll('"', '""')}"`;
}

function writeCsv(file, headers, rows) {
  const body = rows.map((row) => headers.map((key) => csvCell(row[key])).join(","));
  fs.writeFileSync(file, `${headers.join(",")}\n${body.join("\n")}`);
}

function parseExplicitRate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function preparedSellingPrice(rate) {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return rate;
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

async function fetchAllSourceProducts() {
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

function blank(value) {
  const text = String(value ?? "").trim();
  return text.length && text !== "-" ? text : null;
}

async function main() {
  if (!fs.existsSync(FULL_JSON)) {
    throw new Error("Missing full-catalogue.json");
  }

  const products = JSON.parse(fs.readFileSync(FULL_JSON, "utf8"));
  if (products.length !== 8182) {
    throw new Error(`Expected 8182 stored products; found ${products.length}`);
  }

  const { items, total, pages } = await fetchAllSourceProducts();
  if (items.length !== 8182 || total !== 8182) {
    throw new Error(`Expected 8182 live API records; got items=${items.length} total=${total} pages=${pages}`);
  }

  const liveById = new Map();
  const liveBySku = new Map();
  for (const raw of items) {
    if (raw.id) liveById.set(String(raw.id), raw);
    if (raw.sku) liveBySku.set(String(raw.sku), raw);
  }

  let matched = 0;
  let unmatched = 0;
  let rateUpdated = 0;
  let rateSame = 0;
  let liveRatePresent = 0;
  let liveRateZero = 0;
  let liveRateMissing = 0;
  let sellingPrepared = 0;
  let sellingBlank = 0;
  const mismatches = [];
  const samplePrepared = [];

  for (const product of products) {
    const live = (product.sourceId && liveById.get(String(product.sourceId))) || (product.sku && liveBySku.get(String(product.sku)));
    if (!live) {
      unmatched += 1;
      continue;
    }
    matched += 1;
    const liveRate = parseExplicitRate(live.price);
    const storedRate = parseExplicitRate(product.sourcePrice);
    if (liveRate == null) liveRateMissing += 1;
    else if (liveRate === 0) liveRateZero += 1;
    else liveRatePresent += 1;

    if (storedRate !== liveRate) {
      rateUpdated += 1;
      if (mismatches.length < 20) {
        mismatches.push({
          sku: product.sku,
          stored: storedRate,
          live: liveRate,
        });
      }
      product.sourcePrice = liveRate;
    } else {
      rateSame += 1;
    }

    const selling = preparedSellingPrice(product.sourcePrice);
    if (selling != null) sellingPrepared += 1;
    else sellingBlank += 1;

    if (samplePrepared.length < 8 && selling != null) {
      samplePrepared.push({
        partNo: product.sku,
        name: product.name,
        moq: product.moq,
        oeNumber: product.oeCode || "",
        hsn: product.hsn || "",
        source_rate: product.sourcePrice,
        selling_price: selling,
        mrp: "",
        unit: product.uom,
        rateDisplay: `Rs ${selling} / ${product.uom || ""}`.trim(),
      });
    }
  }

  if (unmatched !== 0) {
    throw new Error(`Could not match ${unmatched} stored records to live API products.`);
  }

  const ready = products.filter((p) => p.validationStatus === "READY");
  const review = products.filter((p) => p.validationStatus === "REVIEW");
  if (ready.length !== 7993 || review.length !== 189) {
    throw new Error(`Status counts changed: READY=${ready.length} REVIEW=${review.length}`);
  }

  const firmAssigned = ready.filter((p) => p.firmAssignment).length;
  if (firmAssigned !== 0) {
    throw new Error(`Unexpected firm assignments: ${firmAssigned}`);
  }

  const readySelling = ready.filter((p) => preparedSellingPrice(p.sourcePrice) != null).length;
  const readyBlankSelling = ready.length - readySelling;
  const readyMrp = ready.filter((p) => p.mrp != null && p.mrp !== "").length;
  const example = products.find((p) => p.sku === "5240L,M5");

  fs.writeFileSync(FULL_JSON, `${JSON.stringify(products, null, 2)}\n`);

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
    products.map((p) => ({
      ...p,
      vehicleTypes: (p.vehicleTypes || []).join("; "),
      source_rate: p.sourcePrice ?? "",
      mrp: "",
      selling_price: preparedSellingPrice(p.sourcePrice) ?? "",
      firm: "",
    })),
  );

  writeCsv(
    path.join(OUT, "import-ready.csv"),
    [
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
    ],
    ready.map((p) => ({
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
    })),
  );

  const report = {
    extractedAt: new Date().toISOString(),
    source: `${SOURCE}/b2b`,
    api: `${SOURCE}/api/b2b/products`,
    live: { total, pages, items: items.length },
    stored: { full: products.length, READY: ready.length, REVIEW: review.length },
    match: { matched, unmatched, rateSame, rateUpdated, mismatches },
    rates: {
      liveRatePresent,
      liveRateZero,
      liveRateMissing,
      sellingPrepared,
      sellingBlank,
      readySellingPrepared: readySelling,
      readySellingBlank: readyBlankSelling,
      readyMrpPopulated: readyMrp,
      readyFirmAssigned: firmAssigned,
    },
    exampleRequiredPresentation: example
      ? {
          "Part No": example.sku,
          "Product Name": example.name,
          MOQ: example.moq,
          "OE Number": example.oeCode || "",
          HSN: example.hsn || "",
          Rate: `Rs ${example.sourcePrice} / ${example.uom}`,
          selling_price: preparedSellingPrice(example.sourcePrice),
          mrp: "",
          firm: "",
        }
      : null,
    samplePrepared,
    notes: [
      "Live API field used for Rate: items[].price",
      "source_rate stores that exact numeric price, including 0 when the API sends 0.",
      "selling_price is copied from source_rate only when the rate is explicit and greater than 0.",
      "Records with API price 0 keep source_rate 0 and blank selling_price (no invented replacement).",
      "previousPrice is not treated as MRP.",
      "Firm remains unassigned.",
      "REVIEW records excluded from import-ready.csv.",
      "No database import, Typesense reindex, or identity-field invention.",
    ],
  };

  fs.writeFileSync(path.join(OUT, "source-rate-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
