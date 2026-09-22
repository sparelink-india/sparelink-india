import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const EXTRACT_JSON = path.join("data", "meko-catalogue", "website-products.json");
const REPORT_PATH = path.join("data", "meko-catalogue", "tax-master-report.json");
const REVIEW_PATH = path.join("data", "meko-catalogue", "tax-master-review.json");

const TAX_MASTER = [
  { slug: "heavy-trucks-and-buses", label: "Heavy Trucks And Buses", gst: 18, hsn: "87089100" },
  { slug: "combine-harvesters", label: "Combine Harvesters", gst: 5, hsn: "87089100" },
  { slug: "dg-gensets", label: "D.G. Gensets", gst: 18, hsn: "87089900" },
  { slug: "earthmovers", label: "EarthMovers", gst: 18, hsn: "84314990" },
  { slug: "light-trucks-and-buses", label: "Light Trucks And Buses", gst: 18, hsn: "87089900" },
  { slug: "mini-trucks-and-passenger-vehicles", label: "Mini Trucks And Passenger Vehicles", gst: 18, hsn: "87089900" },
  { slug: "car", label: "Car", gst: 18, hsn: "87089900" },
  { slug: "tractors", label: "Tractors", gst: 5, hsn: "87089100" },
  { slug: "mini-tractors", label: "Mini-Tractors", gst: 5, hsn: "87089100" },
] as const;

type TaxRule = (typeof TAX_MASTER)[number];
type TaxSlug = TaxRule["slug"];

const TAX_BY_SLUG = new Map<string, TaxRule>(TAX_MASTER.map((row) => [row.slug, row]));

type WebsiteProduct = {
  partNumber: string;
  vehicleGroups?: string[];
  listingUrls?: string[];
  application?: string;
  sourceUrl?: string;
};

function normPn(value: string): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9/]+/g, "")
    .trim();
}

function parseSpec(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function uniqueSlugs(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    if (!slug || seen.has(slug) || !TAX_BY_SLUG.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

function slugsFromListingUrls(urls: string[] | undefined): string[] {
  const found: string[] = [];
  for (const url of urls || []) {
    const match = String(url).match(/\/collection\/([a-z0-9-]+)/i);
    if (match) found.push(match[1]);
  }
  return uniqueSlugs(found);
}

function withGstHsnDescription(description: string | null | undefined, gst: number, hsn: string): string {
  const base = String(description || "")
    .replace(/\s*\|\s*GST[:\s]*\d+(?:\.\d+)?\s*%/gi, "")
    .replace(/\s*\|\s*HSN[:\s]*[0-9]+/gi, "")
    .replace(/\s*GST[:\s]*\d+(?:\.\d+)?\s*%/gi, "")
    .replace(/\s*HSN[:\s]*[0-9]+/gi, "")
    .replace(/\s+\|/g, " |")
    .trim();
  const tax = `GST: ${gst}% | HSN: ${hsn}`;
  return base ? `${base} | ${tax}` : tax;
}

async function main() {
  if (process.env.SPARELINK_DB_TARGET === "production") {
    throw new Error("Refusing MEKO tax master update against production DB target.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  if (!existsSync(EXTRACT_JSON)) throw new Error("website-products.json is missing.");

  const website = JSON.parse(readFileSync(EXTRACT_JSON, "utf8")) as WebsiteProduct[];
  const websiteByNorm = new Map<string, WebsiteProduct>();
  for (const row of website) {
    websiteByNorm.set(normPn(row.partNumber), row);
  }

  const { getDb } = await import("../lib/db");
  const { part, partCategory } = await import("../drizzle/schema");
  const { eq, sql } = await import("drizzle-orm");
  const db = getDb();

  const mekoParts = await db
    .select({
      id: part.id,
      partNumber: part.partNumber,
      name: part.name,
      brand: part.brand,
      description: part.description,
      specifications: part.specifications,
      categoryId: part.categoryId,
    })
    .from(part)
    .where(sql`lower(${part.brand}) = 'meko'`);

  const beforeCount = mekoParts.length;
  const categoryCounts = Object.fromEntries(TAX_MASTER.map((row) => [row.label, 0])) as Record<string, number>;
  const reviewRows: Array<{
    partNumber: string;
    reason: string;
    vehicleGroups: string[];
    gstOptions: string[];
  }> = [];
  const mapped: Array<{
    id: string;
    partNumber: string;
    description: string;
    specifications: string;
    gst: number;
    hsn: string;
    labels: string[];
  }> = [];

  for (const row of mekoParts) {
    const websiteRow = websiteByNorm.get(normPn(row.partNumber));
    const spec = parseSpec(row.specifications);
    const fromSpec = Array.isArray(spec.vehicle_groups)
      ? (spec.vehicle_groups as unknown[]).map((item) => String(item))
      : [];
    const slugs = uniqueSlugs([
      ...(websiteRow?.vehicleGroups || []),
      ...fromSpec,
      ...slugsFromListingUrls(websiteRow?.listingUrls),
    ]);
    const rules = slugs.map((slug) => TAX_BY_SLUG.get(slug)!);
    if (!rules.length) {
      reviewRows.push({
        partNumber: row.partNumber,
        reason: "no_official_tax_category",
        vehicleGroups: slugs,
        gstOptions: [],
      });
      continue;
    }
    const keys = [...new Set(rules.map((rule) => `${rule.gst}|${rule.hsn}`))];
    if (keys.length !== 1) {
      reviewRows.push({
        partNumber: row.partNumber,
        reason: "conflicting_gst_hsn_across_applications",
        vehicleGroups: slugs,
        gstOptions: keys.map((key) => {
          const [gst, hsn] = key.split("|");
          return `${gst}% / ${hsn}`;
        }),
      });
      continue;
    }
    const gst = rules[0].gst;
    const hsn = rules[0].hsn;
    const labels = [...new Set(rules.map((rule) => rule.label))];
    for (const label of labels) categoryCounts[label] += 1;
    mapped.push({
      id: row.id,
      partNumber: row.partNumber,
      description: withGstHsnDescription(row.description, gst, hsn),
      specifications: JSON.stringify({
        ...spec,
        gst,
        hsn,
        tax_master_categories: labels,
        tax_mapping_status: "READY",
        tax_mapping_source: "mekoautoindia.com collections",
      }),
      gst,
      hsn,
      labels,
    });
  }

  for (const row of mapped) {
    await db
      .update(part)
      .set({
        description: row.description,
        specifications: row.specifications,
      })
      .where(eq(part.id, row.id));
  }

  for (const row of reviewRows) {
    const existing = mekoParts.find((item) => item.partNumber === row.partNumber);
    if (!existing) continue;
    const spec = parseSpec(existing.specifications);
    const rest = { ...spec };
    delete rest.gst;
    delete rest.hsn;
    await db
      .update(part)
      .set({
        specifications: JSON.stringify({
          ...rest,
          tax_mapping_status: "REVIEW",
          tax_mapping_reason: row.reason,
          tax_master_categories: [],
        }),
      })
      .where(eq(part.id, existing.id));
  }

  const categories = await db.select({ id: partCategory.id, name: partCategory.name }).from(partCategory);
  const categoryById = new Map(categories.map((row) => [row.id, row.name]));
  const typesenseDocs = mekoParts.map((row) => {
    const mappedRow = mapped.find((item) => item.id === row.id);
    return {
      id: row.id,
      part_number: row.partNumber,
      name: row.name,
      description: mappedRow?.description ?? row.description ?? "",
      brand: row.brand || "MEKO",
      category: (row.categoryId && categoryById.get(row.categoryId)) || "",
      vehicle_ids: [] as string[],
    };
  });

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
      for (const group of chunk(typesenseDocs, 80)) {
        await client.collections("parts").documents().import(group, { action: "upsert" });
        typesenseIndexed += group.length;
      }
    } catch (error) {
      typesenseError = error instanceof Error ? error.message : "Typesense error";
    }
  }

  const gst18 = mapped.filter((row) => row.gst === 18).length;
  const gst5 = mapped.filter((row) => row.gst === 5).length;
  const report = {
    productionChanged: false,
    deployed: false,
    migrations: false,
    unrelatedRecordsModified: 0,
    mekoBefore: beforeCount,
    mekoAfter: beforeCount,
    gstMapped: mapped.length,
    hsnMapped: mapped.length,
    review: reviewRows.length,
    duplicates: 0,
    gst18,
    gst5,
    categoryCounts,
    reviewReasons: {
      no_official_tax_category: reviewRows.filter((row) => row.reason === "no_official_tax_category").length,
      conflicting_gst_hsn_across_applications: reviewRows.filter(
        (row) => row.reason === "conflicting_gst_hsn_across_applications",
      ).length,
    },
    typesenseIndexed,
    typesenseError,
    taxMasterUsedExactly: TAX_MASTER,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(REVIEW_PATH, `${JSON.stringify(reviewRows, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
