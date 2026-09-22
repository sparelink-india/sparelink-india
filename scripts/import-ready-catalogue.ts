import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const READY_PATH = path.join("data", "source-catalogue", "import-ready.csv");
const JSON_PATH = path.join("data", "source-catalogue", "full-catalogue.json");
const BACKUP_ROOT = "T:\\sparelink-safety-backups";
const FIRM_NAME = "Ambaji Traders";
const DEALER_CANDIDATES = ["dealer-test-001", "dealer-001"];

function csvCellParseLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else cur += c;
  }
  cells.push(cur);
  return cells;
}

function parseCsv(file: string) {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const nonempty = text.split("\n").filter((line) => line.length > 0);
  const header = csvCellParseLine(nonempty[0]);
  const rows = nonempty.slice(1).map((line) => {
    const cells = csvCellParseLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    return row;
  });
  return { header, rows };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "item";
}

function rupeesToPaise(value: string): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type SourceProduct = {
  sourceId: string | null;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  validationStatus: string;
};

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }
  if (!existsSync(READY_PATH) || !existsSync(JSON_PATH)) {
    throw new Error("Catalogue files missing.");
  }

  const readyFile = parseCsv(READY_PATH);
  if (readyFile.rows.length !== 7993) throw new Error(`READY count mismatch: ${readyFile.rows.length}`);
  const notReady = readyFile.rows.filter((row) => row.validation_status !== "READY");
  if (notReady.length) throw new Error("Non-READY rows in import-ready.csv");
  const ambaji = readyFile.rows.filter((row) => row.firm === FIRM_NAME).length;
  if (ambaji !== 7993) throw new Error(`Firm mismatch: ${ambaji}`);
  const positiveSelling = readyFile.rows.filter((row) => rupeesToPaise(row.selling_price) != null).length;
  const blankSelling = readyFile.rows.filter((row) => !row.selling_price).length;
  if (positiveSelling !== 7780) throw new Error(`Positive selling mismatch: ${positiveSelling}`);
  if (blankSelling !== 213) throw new Error(`Blank selling mismatch: ${blankSelling}`);
  const mrpFilled = readyFile.rows.filter((row) => row.mrp).length;
  if (mrpFilled !== 0) throw new Error("MRP is not blank.");

  const products = JSON.parse(readFileSync(JSON_PATH, "utf8")) as SourceProduct[];
  const reviewSkus = new Set(
    products.filter((p) => p.validationStatus === "REVIEW").map((p) => String(p.sku || "")),
  );
  const leakedReview = readyFile.rows.filter((row) => reviewSkus.has(row.part_number) || reviewSkus.has(row.sku));
  if (leakedReview.length) throw new Error("REVIEW SKU found in READY import file.");
  const bySku = new Map(products.map((p) => [String(p.sku || ""), p]));

  const { getDb } = await import("../lib/db");
  const {
    part,
    partCategory,
    dealer,
    dealerListing,
    inventory,
    firm,
  } = await import("../drizzle/schema");
  const { count, inArray, sql } = await import("drizzle-orm");

  const db = getDb();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(BACKUP_ROOT, `ready-import-${stamp}`);
  mkdirSync(backupDir, { recursive: true });

  const snapshot = {
    takenAt: new Date().toISOString(),
    note: "Pre-import snapshot of catalogue-related tables. Secrets not included.",
    part: await db.select().from(part),
    partCategory: await db.select().from(partCategory),
    dealerListing: await db.select().from(dealerListing),
    inventory: await db.select().from(inventory),
    firm: await db.select({ id: firm.id, name: firm.name, code: firm.code }).from(firm),
    dealer: await db.select({ id: dealer.id, businessName: dealer.businessName }).from(dealer),
  };
  writeFileSync(path.join(backupDir, "catalogue-tables.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  writeFileSync(
    path.join(backupDir, "README.txt"),
    "SpareLink India pre-import snapshot. DATABASE_URL not stored. Restore by re-inserting these rows if needed.\n",
  );

  const existingParts = snapshot.part;
  const existingNumbers = new Set(existingParts.map((row) => row.partNumber));
  const overlap = readyFile.rows.filter((row) => existingNumbers.has(row.part_number));
  if (overlap.length) {
    throw new Error(`Refusing import: ${overlap.length} READY SKUs already exist in SpareLink part table.`);
  }

  const ambajiFirm = snapshot.firm.find((row) => row.name === FIRM_NAME);
  if (!ambajiFirm) throw new Error("Ambaji Traders firm not found in database.");

  const dealerRow =
    snapshot.dealer.find((row) => DEALER_CANDIDATES.includes(row.id)) || snapshot.dealer[0];
  if (!dealerRow) throw new Error("No dealer exists for listing.dealer_id.");

  const existingCategories = new Map(snapshot.partCategory.map((row) => [row.name, row]));
  const usedCategoryIds = new Set(snapshot.partCategory.map((row) => row.id));
  const usedSlugs = new Set(snapshot.partCategory.map((row) => row.slug));
  const categoriesToInsert: Array<{ id: string; name: string; slug: string; description: string | null }> = [];

  for (const row of readyFile.rows) {
    const name = row.category?.trim();
    if (!name || existingCategories.has(name) || categoriesToInsert.some((c) => c.name === name)) continue;
    const source = bySku.get(row.sku);
    let id = source?.categoryId || `cat-${slugify(name)}`;
    if (usedCategoryIds.has(id)) {
      id = `cat-src-${slugify(name)}`;
    }
    let suffix = 2;
    while (usedCategoryIds.has(id)) {
      id = `cat-src-${slugify(name)}-${suffix}`;
      suffix += 1;
    }
    let slug = slugify(name);
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${slugify(id)}`.slice(0, 90);
    }
    suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${slugify(name)}-${suffix}`;
      suffix += 1;
    }
    usedCategoryIds.add(id);
    usedSlugs.add(slug);
    const created = { id, name, slug, description: null };
    categoriesToInsert.push(created);
    existingCategories.set(name, created as (typeof snapshot.partCategory)[number]);
  }

  if (categoriesToInsert.length) {
    for (const group of chunk(categoriesToInsert, 40)) {
      await db.insert(partCategory).values(group);
    }
  }

  const categoryNameToId = new Map<string, string>();
  const latestCats = await db.select({ id: partCategory.id, name: partCategory.name }).from(partCategory);
  for (const cat of latestCats) categoryNameToId.set(cat.name, cat.id);

  let insertedParts = 0;
  let insertedListings = 0;
  let insertedInventory = 0;
  const importedPartIds: string[] = [];
  const typesenseDocs: Array<{
    id: string;
    part_number: string;
    name: string;
    description: string;
    brand: string;
    category: string;
    vehicle_ids: string[];
  }> = [];

  for (const group of chunk(readyFile.rows, 40)) {
    const partRows: Array<{
      id: string;
      partNumber: string;
      name: string;
      description: string;
      brand: string | null;
      categoryId: string | null;
      oemNumber: string | null;
      barcode: string | null;
      specifications: string;
      slug: string;
      isPublished: boolean;
    }> = [];
    const listingRows: Array<{
      id: string;
      dealerId: string;
      firmId: string;
      partId: string;
      sku: string;
      pricePaise: number;
      mrpPaise: null;
      status: string;
    }> = [];
    const inventoryRows: Array<{
      id: string;
      dealerListingId: string;
      quantity: number;
      reservedQuantity: number;
      warehouseCode: string;
    }> = [];
    for (const row of group) {
      const source = bySku.get(row.sku) || bySku.get(row.part_number);
      if (source?.validationStatus === "REVIEW") {
        throw new Error(`Attempted to import REVIEW sku ${row.sku}`);
      }
      const sourceId = source?.sourceId || row.part_number;
      const partId = `part-${sourceId}`;
      const listingId = `listing-amb-${sourceId}`;
      const inventoryId = `inv-amb-${sourceId}`;
      const sellingPaise = rupeesToPaise(row.selling_price);
      const spec = {
        moq: row.moq || null,
        uom: row.uom || null,
        source_rate: row.source_rate || null,
        gst: row.gst || null,
        hsn: row.hsn || null,
        source_url: row.source_url || null,
        source_image_url: row.source_image_url || null,
      };
      partRows.push({
        id: partId,
        partNumber: row.part_number,
        name: row.part_name,
        description: row.description || row.part_name,
        brand: row.brand || null,
        categoryId: row.category ? categoryNameToId.get(row.category) || null : null,
        oemNumber: row.oem_number || null,
        barcode: source?.barcode || null,
        specifications: JSON.stringify(spec),
        slug: slugify(`${row.part_number}-${sourceId}`),
        isPublished: true,
      });
      listingRows.push({
        id: listingId,
        dealerId: dealerRow.id,
        firmId: ambajiFirm.id,
        partId,
        sku: row.sku || row.part_number,
        pricePaise: sellingPaise ?? 0,
        mrpPaise: null,
        status: "active",
      });
      inventoryRows.push({
        id: inventoryId,
        dealerListingId: listingId,
        quantity: 0,
        reservedQuantity: 0,
        warehouseCode: "MAIN",
      });
      importedPartIds.push(partId);
      typesenseDocs.push({
        id: partId,
        part_number: row.part_number,
        name: row.part_name,
        description: row.description || "",
        brand: row.brand || "",
        category: row.category || "",
        vehicle_ids: [],
      });
    }
    await db.transaction(async (tx) => {
      await tx.insert(part).values(partRows);
      await tx.insert(dealerListing).values(listingRows);
      await tx.insert(inventory).values(inventoryRows);
    });
    insertedParts += partRows.length;
    insertedListings += listingRows.length;
    insertedInventory += inventoryRows.length;
    process.stdout.write(`imported ${insertedParts}/7993\n`);
  }

  const importedListings = await db
    .select({
      id: dealerListing.id,
      sku: dealerListing.sku,
      firmId: dealerListing.firmId,
      pricePaise: dealerListing.pricePaise,
      mrpPaise: dealerListing.mrpPaise,
    })
    .from(dealerListing)
    .where(inArray(dealerListing.partId, importedPartIds));

  const actualImported = importedListings.length;
  const actualAmbaji = importedListings.filter((row) => row.firmId === ambajiFirm.id).length;
  const actualPositive = importedListings.filter((row) => row.pricePaise > 0).length;
  const actualBlank = importedListings.filter((row) => row.pricePaise === 0).length;
  const actualMrp = importedListings.filter((row) => row.mrpPaise != null).length;
  const [totalParts] = await db.select({ n: count() }).from(part);
  const duplicatePartNumbers = await db
    .select({ partNumber: part.partNumber, n: count() })
    .from(part)
    .groupBy(part.partNumber)
    .having(sql`count(*) > 1`);

  const reviewImported = importedListings.filter((row) => reviewSkus.has(String(row.sku || ""))).length;

  if (actualImported !== 7993) throw new Error(`DB imported listings ${actualImported}, expected 7993`);
  if (actualAmbaji !== 7993) throw new Error(`DB Ambaji listings ${actualAmbaji}, expected 7993`);
  if (actualPositive !== 7780) throw new Error(`DB positive selling ${actualPositive}, expected 7780`);
  if (actualBlank !== 213) throw new Error(`DB blank/zero selling ${actualBlank}, expected 213`);
  if (actualMrp !== 0) throw new Error(`DB MRP populated ${actualMrp}, expected 0`);
  if (reviewImported !== 0) throw new Error("REVIEW records were imported.");
  if (duplicatePartNumbers.length) throw new Error("Duplicate part_number values exist after import.");
  if (insertedParts !== 7993 || insertedListings !== 7993 || insertedInventory !== 7993) {
    throw new Error("Insert counters mismatch.");
  }

  let typesenseIndexed = 0;
  let typesenseError: string | null = null;
  if (!process.env.TYPESENSE_HOST || !process.env.TYPESENSE_API_KEY) {
    typesenseError = "Typesense env not configured.";
  } else {
    const Typesense = (await import("typesense")).default;
    const client = new Typesense.Client({
      nodes: [
        {
          host: process.env.TYPESENSE_HOST,
          port: Number(process.env.TYPESENSE_PORT ?? 443),
          protocol: process.env.TYPESENSE_PROTOCOL ?? "https",
        },
      ],
      apiKey: process.env.TYPESENSE_API_KEY,
      connectionTimeoutSeconds: 60,
    });
    try {
      for (const group of chunk(typesenseDocs, 100)) {
        const result = await client.collections("parts").documents().import(group, { action: "upsert" });
        const failed = Array.isArray(result) ? result.filter((row) => row.success === false) : [];
        if (failed.length) {
          throw new Error(`Typesense upsert failed for ${failed.length} documents in a batch.`);
        }
        typesenseIndexed += group.length;
      }
    } catch (error) {
      typesenseError = error instanceof Error ? error.message : "Typesense error";
    }
  }

  const report = {
    backupDir,
    dealerUsed: { id: dealerRow.id, businessName: dealerRow.businessName },
    firmUsed: { id: ambajiFirm.id, name: ambajiFirm.name },
    insertedParts,
    insertedListings,
    insertedInventory,
    actualImported,
    actualAmbaji,
    actualPositive,
    actualBlank,
    actualMrp,
    reviewImported,
    totalPartsInDatabase: Number(totalParts.n),
    preexistingParts: existingParts.length,
    categoriesCreated: categoriesToInsert.length,
    typesenseIndexed,
    typesenseError,
    databaseWrites: true,
    migrations: false,
    productionDeploy: false,
  };
  writeFileSync(path.join(backupDir, "import-run-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(
    path.join("data", "source-catalogue", "import-run-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("IMPORT ERROR:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
