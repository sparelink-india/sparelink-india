import { promises as fs } from "fs";
import path from "path";

import { catalogueImagePublicPath } from "@/lib/catalogue-image-index";
import { SPARELINK_FIRMS } from "@/lib/firms";

const CATALOGUE_PATH = path.join(
  process.cwd(),
  "data",
  "source-catalogue",
  "full-catalogue.json",
);
const OVERLAY_PATH = path.join(
  process.cwd(),
  "data",
  "source-catalogue",
  "admin-assignments.json",
);
const ORIGINAL_IMPORT_CSV = path.join(
  process.cwd(),
  "data",
  "source-catalogue",
  "import-ready.csv",
);

export const FIRM_NAMES = SPARELINK_FIRMS.map((firm) => firm.name);
export const FIRM_NAME_SET = new Set(FIRM_NAMES);

export type SourceCatalogueProduct = {
  sourceId: string | null;
  sku: string | null;
  name: string | null;
  brand: string | null;
  categoryName: string | null;
  vehicleTypes: string[];
  oeCode: string | null;
  hsn: string | null;
  gst: number | null;
  moq: number | null;
  sourcePrice: number | null;
  uom: string | null;
  statusSource: string | null;
  imageUrl: string | null;
  localImagePath: string | null;
  imageStatus: string | null;
  validationStatus: string;
  reviewReasons: string[];
  sourceUrl: string | null;
  firmAssignment: string | null;
  description?: string | null;
};

export type AdminAssignment = {
  firm: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  updatedAt: string;
};

export type AdminOverlay = {
  updatedAt: string | null;
  note: string;
  assignments: Record<string, AdminAssignment>;
};

export type CatalogueIssue =
  | "READY"
  | "REVIEW"
  | "FIRM ASSIGNMENT REQUIRED"
  | "MRP REQUIRED"
  | "SELLING PRICE REQUIRED"
  | "IMAGE REVIEW"
  | "NOT IMPORTED"
  | "IDENTITY REQUIRED"
  | "CATEGORY REQUIRED";

export type SourceCatalogueListItem = {
  key: string;
  sku: string | null;
  name: string | null;
  brand: string | null;
  categoryName: string | null;
  compatibility: string;
  oeCode: string | null;
  hsn: string | null;
  gst: number | null;
  moq: number | null;
  uom: string | null;
  sourcePrice: number | null;
  sourceUrl: string | null;
  rateDisplay: string;
  validationStatus: string;
  reviewReasons: string[];
  missingFields: string[];
  issues: CatalogueIssue[];
  firmAssignment: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  importStatus: "NOT IMPORTED";
  importEligible: boolean;
  imageStatus: string | null;
  localImagePath: string | null;
  hasImage: boolean;
};

export type CatalogueFilters = {
  status?: string;
  query?: string;
  category?: string;
  image?: string;
  firm?: string;
  issue?: string;
};

let cachedProducts: SourceCatalogueProduct[] | null = null;
let overlayWriteQueue: Promise<unknown> = Promise.resolve();

export function productKey(product: {
  sku?: string | null;
  sourceId?: string | null;
}): string {
  return String(product.sku || product.sourceId || "").trim();
}

export function hasSourceImage(product: SourceCatalogueProduct): boolean {
  return (
    product.imageStatus === "downloaded" ||
    product.imageStatus === "duplicate_url" ||
    Boolean(product.localImagePath)
  );
}

export async function loadSourceCatalogue(): Promise<SourceCatalogueProduct[]> {
  if (cachedProducts) return cachedProducts;
  const raw = await fs.readFile(CATALOGUE_PATH, "utf8");
  cachedProducts = JSON.parse(raw) as SourceCatalogueProduct[];
  return cachedProducts;
}

export async function loadAdminOverlay(): Promise<AdminOverlay> {
  try {
    const raw = await fs.readFile(OVERLAY_PATH, "utf8");
    const parsed = JSON.parse(raw) as AdminOverlay;
    return {
      updatedAt: parsed.updatedAt ?? null,
      note:
        parsed.note ||
        "Admin overlay only. Does not modify original extraction files or the database.",
      assignments: parsed.assignments || {},
    };
  } catch {
    return {
      updatedAt: null,
      note: "Admin overlay only. Does not modify original extraction files or the database.",
      assignments: {},
    };
  }
}

async function writeAdminOverlay(overlay: AdminOverlay): Promise<void> {
  const tmp = `${OVERLAY_PATH}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(overlay, null, 2)}\n`, "utf8");
  await fs.rename(tmp, OVERLAY_PATH);
}

export async function updateAdminOverlay(
  updater: (overlay: AdminOverlay) => AdminOverlay,
): Promise<AdminOverlay> {
  const run = overlayWriteQueue.then(async () => {
    const current = await loadAdminOverlay();
    const next = updater(current);
    next.updatedAt = new Date().toISOString();
    next.note =
      "Admin overlay only. Does not modify original extraction files or the database.";
    await writeAdminOverlay(next);
    return next;
  });
  overlayWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function preparedSellingPriceFromSource(sourcePrice: number | null | undefined): number | null {
  if (sourcePrice == null || !Number.isFinite(sourcePrice) || sourcePrice <= 0) return null;
  return sourcePrice;
}

export function formatSourceRate(sourcePrice: number | null | undefined, uom: string | null | undefined): string {
  const selling = preparedSellingPriceFromSource(sourcePrice);
  if (selling == null) return "";
  const unit = String(uom || "").trim();
  return unit ? `Rs ${selling} / ${unit}` : `Rs ${selling}`;
}

export function mergeProduct(
  product: SourceCatalogueProduct,
  overlay: AdminOverlay,
): SourceCatalogueProduct & { mrp: number | null; sellingPrice: number | null } {
  const key = productKey(product);
  const assignment = key ? overlay.assignments[key] : undefined;
  return {
    ...product,
    firmAssignment: assignment?.firm && FIRM_NAME_SET.has(assignment.firm) ? assignment.firm : null,
    mrp: assignment?.mrp ?? null,
    sellingPrice: assignment?.sellingPrice ?? preparedSellingPriceFromSource(product.sourcePrice),
  };
}

export function collectIssues(
  product: SourceCatalogueProduct & { mrp: number | null; sellingPrice: number | null },
): CatalogueIssue[] {
  const issues: CatalogueIssue[] = [];
  if (product.validationStatus === "READY") issues.push("READY");
  if (product.validationStatus === "REVIEW") issues.push("REVIEW");
  if (!product.sku || !product.name) issues.push("IDENTITY REQUIRED");
  if (!product.categoryName) issues.push("CATEGORY REQUIRED");
  if (!product.firmAssignment || !FIRM_NAME_SET.has(product.firmAssignment)) {
    issues.push("FIRM ASSIGNMENT REQUIRED");
  }
  if (!isAssignedMrp(product.mrp)) issues.push("MRP REQUIRED");
  if (!isAssignedSellingPrice(product.sellingPrice)) issues.push("SELLING PRICE REQUIRED");
  if (
    isAssignedMrp(product.mrp) &&
    isAssignedSellingPrice(product.sellingPrice) &&
    (product.sellingPrice as number) > (product.mrp as number)
  ) {
    issues.push("SELLING PRICE REQUIRED");
  }
  if (!hasSourceImage(product)) issues.push("IMAGE REVIEW");
  issues.push("NOT IMPORTED");
  return issues;
}

export function isAssignedMrp(mrp: number | null): boolean {
  return mrp != null && Number.isFinite(mrp) && mrp >= 1;
}

export function isAssignedSellingPrice(sellingPrice: number | null): boolean {
  return sellingPrice != null && Number.isFinite(sellingPrice) && sellingPrice >= 1;
}

export function isValidImportPrice(mrp: number | null, sellingPrice: number | null): boolean {
  if (!isAssignedMrp(mrp) || !isAssignedSellingPrice(sellingPrice)) return false;
  if ((sellingPrice as number) > (mrp as number)) return false;
  return true;
}

export function isImportEligible(
  product: SourceCatalogueProduct & { mrp: number | null; sellingPrice: number | null },
): boolean {
  const issues = collectIssues(product);
  return (
    product.validationStatus === "READY" &&
    issues.includes("READY") &&
    !issues.includes("REVIEW") &&
    !issues.includes("IDENTITY REQUIRED") &&
    !issues.includes("CATEGORY REQUIRED") &&
    !issues.includes("FIRM ASSIGNMENT REQUIRED") &&
    !issues.includes("MRP REQUIRED") &&
    !issues.includes("SELLING PRICE REQUIRED") &&
    !issues.includes("IMAGE REVIEW")
  );
}

export function toListItem(
  product: SourceCatalogueProduct,
  overlay?: AdminOverlay,
): SourceCatalogueListItem {
  const merged = overlay ? mergeProduct(product, overlay) : mergeProduct(product, { updatedAt: null, note: "", assignments: {} });
  const issues = collectIssues(merged);
  const missingFields: string[] = [];
  if (issues.includes("FIRM ASSIGNMENT REQUIRED")) missingFields.push("firm");
  if (issues.includes("MRP REQUIRED")) missingFields.push("mrp");
  if (issues.includes("SELLING PRICE REQUIRED")) missingFields.push("selling_price");
  if (product.sourcePrice == null) missingFields.push("sourcePrice");
  if (!product.hsn) missingFields.push("hsn");
  if (!product.oeCode) missingFields.push("oem");
  if (issues.includes("IMAGE REVIEW")) missingFields.push("image");
  if (!product.sku) missingFields.push("sku");
  if (!product.name) missingFields.push("name");
  if (!product.categoryName) missingFields.push("category");

  return {
    key: productKey(product),
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    categoryName: product.categoryName,
    compatibility: (product.vehicleTypes || []).join("; "),
    oeCode: product.oeCode,
    hsn: product.hsn,
    gst: product.gst,
    moq: product.moq ?? null,
    uom: product.uom,
    sourcePrice: product.sourcePrice,
    sourceUrl: product.sourceUrl,
    rateDisplay: formatSourceRate(product.sourcePrice, product.uom),
    validationStatus: product.validationStatus,
    reviewReasons: product.reviewReasons || [],
    missingFields,
    issues,
    firmAssignment: merged.firmAssignment,
    mrp: merged.mrp,
    sellingPrice: merged.sellingPrice,
    importStatus: "NOT IMPORTED",
    importEligible: isImportEligible(merged),
    imageStatus: product.imageStatus,
    localImagePath: product.localImagePath,
    hasImage: hasSourceImage(product),
  };
}

export function filterCatalogue(
  products: SourceCatalogueProduct[],
  overlay: AdminOverlay,
  filters: CatalogueFilters,
): SourceCatalogueProduct[] {
  const status = String(filters.status || "ALL").toUpperCase();
  const query = String(filters.query || "").trim().toLowerCase();
  const category = String(filters.category || "").trim();
  const image = String(filters.image || "all").toLowerCase();
  const firm = String(filters.firm || "all");
  const issue = String(filters.issue || "ALL").toUpperCase();

  return products.filter((product) => {
    const merged = mergeProduct(product, overlay);
    if (status !== "ALL" && product.validationStatus !== status) return false;
    if (category && product.categoryName !== category) return false;
    if (image === "missing" && hasSourceImage(product)) return false;
    if (image === "has" && !hasSourceImage(product)) return false;
    if (firm === "unassigned" && merged.firmAssignment) return false;
    if (firm !== "all" && firm !== "unassigned" && merged.firmAssignment !== firm) return false;
    if (issue === "FIRM" && merged.firmAssignment && FIRM_NAME_SET.has(merged.firmAssignment)) {
      return false;
    }
    if (issue === "PRICE" && isValidImportPrice(merged.mrp, merged.sellingPrice)) return false;
    if (issue === "MRP" && isAssignedMrp(merged.mrp)) return false;
    if (issue === "SELLING" && isAssignedSellingPrice(merged.sellingPrice)) return false;
    if (issue === "IMAGE" && hasSourceImage(product)) return false;
    if (issue === "IMPORT_READY" && !isImportEligible(merged)) return false;
    if (query) {
      const haystack = [
        product.sku,
        product.name,
        product.brand,
        product.categoryName,
        product.oeCode,
        ...(product.vehicleTypes || []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function overlaySummary(overlay: AdminOverlay, products: SourceCatalogueProduct[]) {
  let assigned = 0;
  let priced = 0;
  let importEligible = 0;
  let imageReview = 0;
  const byFirm: Record<string, number> = {
    "Ambaji Traders": 0,
    "Hind Motors": 0,
    "India Sales": 0,
  };

  for (const product of products) {
    const merged = mergeProduct(product, overlay);
    if (merged.firmAssignment && FIRM_NAME_SET.has(merged.firmAssignment)) {
      assigned += 1;
      byFirm[merged.firmAssignment] = (byFirm[merged.firmAssignment] || 0) + 1;
    }
    if (isValidImportPrice(merged.mrp, merged.sellingPrice)) priced += 1;
    if (!hasSourceImage(product)) imageReview += 1;
    if (isImportEligible(merged)) importEligible += 1;
  }

  return {
    assigned,
    priced,
    importEligible,
    imageReview,
    unassigned: products.length - assigned,
    byFirm,
  };
}

export type ImportPreview = {
  totalSelected: number;
  validForImport: number;
  missingFirm: number;
  missingPrice: number;
  missingMrp: number;
  missingSellingPrice: number;
  imageReview: number;
  sourceReview: number;
  identityOrCategory: number;
  databaseWrites: 0;
  importDisabled: true;
  validKeys: string[];
  reviewKeys: string[];
};

export function buildImportPreview(
  products: SourceCatalogueProduct[],
  overlay: AdminOverlay,
): ImportPreview {
  let missingFirm = 0;
  let missingPrice = 0;
  let missingMrp = 0;
  let missingSellingPrice = 0;
  let imageReview = 0;
  let sourceReview = 0;
  let identityOrCategory = 0;
  const validKeys: string[] = [];
  const reviewKeys: string[] = [];

  for (const product of products) {
    const merged = mergeProduct(product, overlay);
    const key = productKey(merged);
    if (isImportEligible(merged)) {
      validKeys.push(key);
      continue;
    }
    reviewKeys.push(key);
    const issues = collectIssues(merged);
    if (issues.includes("REVIEW") || issues.includes("IDENTITY REQUIRED") || issues.includes("CATEGORY REQUIRED")) {
      if (issues.includes("REVIEW") || issues.includes("IDENTITY REQUIRED") || issues.includes("CATEGORY REQUIRED")) {
        if (issues.includes("IDENTITY REQUIRED") || issues.includes("CATEGORY REQUIRED")) identityOrCategory += 1;
        if (issues.includes("REVIEW")) sourceReview += 1;
      }
    }
    if (issues.includes("FIRM ASSIGNMENT REQUIRED")) missingFirm += 1;
    if (issues.includes("MRP REQUIRED")) missingMrp += 1;
    if (issues.includes("SELLING PRICE REQUIRED")) missingSellingPrice += 1;
    if (issues.includes("MRP REQUIRED") || issues.includes("SELLING PRICE REQUIRED")) missingPrice += 1;
    if (issues.includes("IMAGE REVIEW")) imageReview += 1;
  }

  return {
    totalSelected: products.length,
    validForImport: validKeys.length,
    missingFirm,
    missingPrice,
    missingMrp,
    missingSellingPrice,
    imageReview,
    sourceReview,
    identityOrCategory,
    databaseWrites: 0,
    importDisabled: true,
    validKeys,
    reviewKeys,
  };
}

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const IMPORT_HEADERS = [
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
] as const;

export function toImportCsvRow(
  product: SourceCatalogueProduct & { mrp: number | null; sellingPrice: number | null },
): string {
  const values = [
    product.sku,
    product.name,
    product.description || product.name,
    product.brand,
    product.categoryName,
    product.sku,
    product.hsn,
    product.gst,
    product.moq,
    product.uom,
    product.sourcePrice,
    product.mrp,
    product.sellingPrice,
    product.oeCode,
    (product.vehicleTypes || []).join("; "),
    product.sourceUrl,
    product.imageUrl,
    product.validationStatus,
    product.firmAssignment,
  ];
  return values.map(csvCell).join(",");
}

export function buildImportCsv(
  products: Array<SourceCatalogueProduct & { mrp: number | null; sellingPrice: number | null }>,
): string {
  const lines = [IMPORT_HEADERS.join(","), ...products.map(toImportCsvRow)];
  return `${lines.join("\n")}\n`;
}

export function buildReviewCsv(
  products: Array<SourceCatalogueProduct & { mrp: number | null; sellingPrice: number | null }>,
): string {
  const headers = [...IMPORT_HEADERS, "issues"].join(",");
  const lines = [
    headers,
    ...products.map((product) => `${toImportCsvRow(product)},${csvCell(collectIssues(product).join("; "))}`),
  ];
  return `${lines.join("\n")}\n`;
}

export async function exportAdminImportPackage(
  selected: SourceCatalogueProduct[],
  overlay: AdminOverlay,
): Promise<{
  preview: ImportPreview;
  files: {
    ready: string;
    review: string;
    validation: string;
  };
}> {
  const preview = buildImportPreview(selected, overlay);
  const byKey = new Map(selected.map((product) => [productKey(product), mergeProduct(product, overlay)]));
  const ready = preview.validKeys
    .map((key) => byKey.get(key))
    .filter((item): item is NonNullable<typeof item> => item != null && item.validationStatus === "READY");
  const review = preview.reviewKeys
    .map((key) => byKey.get(key))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const readyPath = path.join(
    process.cwd(),
    "data",
    "source-catalogue",
    "admin-import-ready.csv",
  );
  const reviewPath = path.join(
    process.cwd(),
    "data",
    "source-catalogue",
    "admin-import-review.csv",
  );
  const validationPath = path.join(
    process.cwd(),
    "data",
    "source-catalogue",
    "admin-import-validation.json",
  );

  const validation = {
    exportedAt: new Date().toISOString(),
    originalFilesUntouched: [
      "full-catalogue.json",
      "full-catalogue.csv",
      "import-ready.csv",
      "ci-automotive-extract.csv",
    ],
    originalImportCsv: path.relative(process.cwd(), ORIGINAL_IMPORT_CSV).replace(/\\/g, "/"),
    imported: false,
    typesenseReindex: false,
    ...preview,
    validKeys: undefined,
    reviewKeys: undefined,
    counts: {
      totalSelected: preview.totalSelected,
      validForImport: preview.validForImport,
      missingFirm: preview.missingFirm,
      missingPrice: preview.missingPrice,
      imageReview: preview.imageReview,
      sourceReview: preview.sourceReview,
      identityOrCategory: preview.identityOrCategory,
    },
    files: {
      ready: path.relative(process.cwd(), readyPath).replace(/\\/g, "/"),
      review: path.relative(process.cwd(), reviewPath).replace(/\\/g, "/"),
      validation: path.relative(process.cwd(), validationPath).replace(/\\/g, "/"),
    },
  };

  await fs.writeFile(readyPath, buildImportCsv(ready), "utf8");
  await fs.writeFile(reviewPath, buildReviewCsv(review), "utf8");
  await fs.writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");

  return {
    preview,
    files: {
      ready: validation.files.ready,
      review: validation.files.review,
      validation: validation.files.validation,
    },
  };
}

export function parseNonNegativeNumber(value: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === "" || value === null || value === undefined) {
    return { ok: true, value: null };
  }
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return { ok: false, error: "Value must be numeric." };
  }
  if (num < 0) {
    return { ok: false, error: "Value must be non-negative." };
  }
  return { ok: true, value: num };
}

export async function resolveSelectedProducts(input: {
  scope: "selected" | "filtered";
  keys?: string[];
  filters?: CatalogueFilters;
}): Promise<SourceCatalogueProduct[]> {
  const products = await loadSourceCatalogue();
  const overlay = await loadAdminOverlay();
  if (input.scope === "filtered") {
    return filterCatalogue(products, overlay, input.filters || {});
  }
  const wanted = new Set((input.keys || []).map((key) => String(key).trim()).filter(Boolean));
  return products.filter((product) => wanted.has(productKey(product)));
}

export function sanitizeCatalogueImageKey(sku: string): string {
  return sku.replace(/[^A-Za-z0-9._-]+/g, "_");
}

export function getCustomerCatalogueImageUrl(sku: string): string | null {
  return catalogueImagePublicPath(sku);
}

export { OVERLAY_PATH, ORIGINAL_IMPORT_CSV };
