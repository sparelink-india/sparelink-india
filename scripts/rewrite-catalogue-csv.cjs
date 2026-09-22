const fs = require("fs");

function csvCell(value) {
  return `"${String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ").replaceAll('"', '""')}"`;
}

function writeCsv(file, headers, rows) {
  const body = rows.map((row) => headers.map((key) => csvCell(row[key])).join(","));
  fs.writeFileSync(file, `${headers.join(",")}\n${body.join("\n")}`);
}

function preparedSellingPrice(rate) {
  if (rate == null || !Number.isFinite(Number(rate)) || Number(rate) <= 0) return null;
  return Number(rate);
}

const products = JSON.parse(fs.readFileSync("data/source-catalogue/full-catalogue.json", "utf8"));
const ready = products.filter((p) => p.validationStatus === "READY");

writeCsv(
  "data/source-catalogue/full-catalogue.csv",
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
  "data/source-catalogue/import-ready.csv",
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

const lines = fs.readFileSync("data/source-catalogue/import-ready.csv", "utf8").trim().split(/\n/).length - 1;
console.log(JSON.stringify({ unique: products.length, ready: ready.length, importReadyLines: lines }));
