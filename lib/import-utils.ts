import { randomUUID } from "crypto";
import * as XLSX from "xlsx";

export interface ImportRow {
  rowNumber: number;
  data: Record<string, string | undefined>;
  errors: string[];
  isValid: boolean;
}

export interface ParsedImportData {
  rows: ImportRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  columnHeaders: string[];
}

export interface ValidationContext {
  existingPartNumbers: Set<string>;
  existingSKUs: Set<string>;
  existingFirmNames: Set<string>;
  existingDealerNames: Set<string>;
  existingCategories: Set<string>;
  firmNameToId: Map<string, string>;
  dealerNameToId: Map<string, string>;
  categoryNameToId: Map<string, string>;
}

// Parse CSV content from string
export function parseCSV(content: string): string[][] {
  const lines = content.split("\n");
  return lines
    .map((line) => {
      const parts: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          parts.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      if (current) parts.push(current.trim());
      return parts;
    })
    .filter((line) => line.some((cell) => cell.length > 0));
}

// Parse Excel file buffer
export async function parseExcel(buffer: Buffer): Promise<string[][]> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("No sheets found in Excel file");

  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

  return data.filter((row) => row.some((cell) => cell && String(cell).trim().length > 0));
}

// Normalize column headers
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// Map user-friendly headers to normalized form
export function createHeaderMap(
  headers: string[],
): Map<string, number> {
  const headerMap = new Map<string, number>();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    headerMap.set(normalized, index);
  });
  return headerMap;
}

// Required columns for different import types
export const PRODUCT_COLUMNS = new Set([
  "part_number",
  "part_name",
  "description",
  "brand",
  "category",
  "sku",
  "hsn",
  "gst",
  "mrp",
  "selling_price",
]);

export const LISTING_COLUMNS = new Set([
  "dealer",
  "firm",
  "part_number",
  "sku",
  "stock",
  "status",
  "selling_price",
  "mrp",
]);

// Detect import type from headers
export function detectImportType(
  headers: string[],
): "product" | "listing" | "unknown" {
  const normalized = new Set(headers.map(normalizeHeader));

  const productMatches = [...PRODUCT_COLUMNS].filter((col) =>
    normalized.has(col),
  ).length;
  const listingMatches = [...LISTING_COLUMNS].filter((col) =>
    normalized.has(col),
  ).length;

  if (productMatches >= 5) return "product";
  if (listingMatches >= 5) return "listing";
  return "unknown";
}

// Parse import rows
export function parseImportRows(
  data: string[][],
  headerMap: Map<string, number>,
): ImportRow[] {
  if (data.length === 0) return [];

  return data.slice(1).map((row, index) => {
    const rowData: Record<string, string | undefined> = {};
    const errors: string[] = [];

    headerMap.forEach((colIndex, headerName) => {
      rowData[headerName] = row[colIndex]?.trim() || undefined;
    });

    const rowNumber = index + 2; // +2 because header is row 1, data starts at row 2

    return {
      rowNumber,
      data: rowData,
      errors,
      isValid: true,
    };
  });
}

// Validate numeric value
export function validateNumeric(
  value: string | undefined,
  fieldName: string,
  min = 0,
): { valid: boolean; value?: number; error?: string } {
  if (!value) {
    return { valid: false, error: `${fieldName} is required` };
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    return {
      valid: false,
      error: `${fieldName} must be a number, got: ${value}`,
    };
  }

  if (num < min) {
    return {
      valid: false,
      error: `${fieldName} must be >= ${min}, got: ${num}`,
    };
  }

  return { valid: true, value: num };
}

// Validate required string field
export function validateString(
  value: string | undefined,
  fieldName: string,
  minLength = 1,
): { valid: boolean; value?: string; error?: string } {
  if (!value) {
    return { valid: false, error: `${fieldName} is required` };
  }

  if (value.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`,
    };
  }

  return { valid: true, value };
}

// Validate product row
export function validateProductRow(
  row: ImportRow,
  context: ValidationContext,
): void {
  const data = row.data;

  // Validate part_number
  const partNumValidation = validateString(data.part_number, "Part Number");
  if (!partNumValidation.valid) {
    row.errors.push(partNumValidation.error!);
  } else if (context.existingPartNumbers.has(partNumValidation.value!)) {
    row.errors.push(
      `Part Number ${partNumValidation.value} already exists`,
    );
  }

  // Validate part_name
  const partNameValidation = validateString(data.part_name, "Part Name");
  if (!partNameValidation.valid) {
    row.errors.push(partNameValidation.error!);
  }

  // Brand and Description are optional
  if (data.brand && data.brand.length > 255) {
    row.errors.push("Brand must be 255 characters or less");
  }

  if (data.description && data.description.length > 1000) {
    row.errors.push("Description must be 1000 characters or less");
  }

  // Validate category
  if (data.category) {
    if (!context.existingCategories.has(data.category)) {
      row.errors.push(
        `Category '${data.category}' not found. Available: ${[...context.existingCategories].join(", ")}`,
      );
    }
  }

  // Validate SKU
  if (data.sku && context.existingSKUs.has(data.sku)) {
    row.errors.push(`SKU ${data.sku} already exists`);
  }

  // Validate HSN (optional, just check format if provided)
  if (data.hsn && !/^\d{6,8}$/.test(data.hsn)) {
    row.errors.push(
      `HSN must be 6-8 digits if provided, got: ${data.hsn}`,
    );
  }

  // Validate GST (optional, 0-100)
  if (data.gst) {
    const gstValidation = validateNumeric(data.gst, "GST", 0);
    if (!gstValidation.valid) {
      row.errors.push(gstValidation.error!);
    } else if (gstValidation.value! > 100) {
      row.errors.push(`GST must be 0-100, got: ${gstValidation.value}`);
    }
  }

  // Validate MRP
  if (data.mrp) {
    const mrpValidation = validateNumeric(data.mrp, "MRP", 1);
    if (!mrpValidation.valid) {
      row.errors.push(mrpValidation.error!);
    }
  }

  // Validate selling_price
  const sellingPriceValidation = validateNumeric(
    data.selling_price,
    "Selling Price",
    1,
  );
  if (!sellingPriceValidation.valid) {
    row.errors.push(sellingPriceValidation.error!);
  }

  row.isValid = row.errors.length === 0;
}

// Validate listing row
export function validateListingRow(
  row: ImportRow,
  context: ValidationContext,
): void {
  const data = row.data;

  // Validate dealer
  const dealerValidation = validateString(data.dealer, "Dealer Name");
  if (!dealerValidation.valid) {
    row.errors.push(dealerValidation.error!);
  } else if (!context.existingDealerNames.has(dealerValidation.value!)) {
    row.errors.push(
      `Dealer '${dealerValidation.value}' not found. Available: ${[...context.existingDealerNames].join(", ")}`,
    );
  }

  // Validate firm
  const firmValidation = validateString(data.firm, "Firm");
  if (!firmValidation.valid) {
    row.errors.push(firmValidation.error!);
  } else if (!context.existingFirmNames.has(firmValidation.value!)) {
    row.errors.push(
      `Firm '${firmValidation.value}' not found. Available: ${[...context.existingFirmNames].join(", ")}`,
    );
  }

  // Validate part_number (reference, not creation)
  const partNumValidation = validateString(data.part_number, "Part Number");
  if (!partNumValidation.valid) {
    row.errors.push(partNumValidation.error!);
  } else if (!context.existingPartNumbers.has(partNumValidation.value!)) {
    row.errors.push(
      `Part Number '${partNumValidation.value}' not found in catalog`,
    );
  }

  // SKU is optional but must be unique if provided
  if (data.sku && context.existingSKUs.has(data.sku)) {
    row.errors.push(`SKU ${data.sku} already exists`);
  }

  // Validate stock
  const stockValidation = validateNumeric(data.stock, "Stock", 0);
  if (!stockValidation.valid) {
    row.errors.push(stockValidation.error!);
  }

  // Validate selling_price
  const sellingPriceValidation = validateNumeric(
    data.selling_price,
    "Selling Price",
    1,
  );
  if (!sellingPriceValidation.valid) {
    row.errors.push(sellingPriceValidation.error!);
  }

  // Validate MRP (optional)
  if (data.mrp) {
    const mrpValidation = validateNumeric(data.mrp, "MRP", 1);
    if (!mrpValidation.valid) {
      row.errors.push(mrpValidation.error!);
    }
  }

  // Validate status
  if (data.status) {
    if (!["active", "inactive"].includes(data.status.toLowerCase())) {
      row.errors.push(
        `Status must be 'active' or 'inactive', got: ${data.status}`,
      );
    }
  }

  row.isValid = row.errors.length === 0;
}

// Generate preview with statistics
export function generatePreview(rows: ImportRow[]): ParsedImportData {
  const validRows = rows.filter((r) => r.isValid).length;
  const invalidRows = rows.filter((r) => !r.isValid).length;

  return {
    rows,
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows: 0, // Duplicates are included in invalidRows due to validation
    columnHeaders: rows.length > 0 ? Object.keys(rows[0].data) : [],
  };
}
