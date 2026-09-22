import { partCategory } from "@/drizzle/schema";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import {
  buildCategoryNavigation,
  classifyWaterPumpSegment,
  isWaterPumpProduct,
  slugifyCategory,
  type CatalogueCategory,
} from "@/lib/category-navigation";
import { loadSourceCatalogue } from "@/lib/source-catalogue";

let pensolCache: Array<{ category: string; name: string }> | null = null;

async function loadPensolNames(): Promise<{ category: string; name: string }[]> {
  if (pensolCache) return pensolCache;
  try {
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    const raw = await readFile(
      path.join(process.cwd(), "data/pensol-catalogue/full-catalogue.json"),
      "utf8",
    );
    const rows = JSON.parse(raw) as Array<{ category?: string; product_name?: string }>;
    pensolCache = rows.map((row) => ({
      category: row.category || "",
      name: row.product_name || "",
    }));
    return pensolCache;
  } catch {
    pensolCache = [];
    return pensolCache;
  }
}

export async function loadCategoryNav() {
  let categories: CatalogueCategory[] = [];
  if (isDatabaseConfigured()) {
    categories = await getDb()
      .select({
        id: partCategory.id,
        name: partCategory.name,
        slug: partCategory.slug,
      })
      .from(partCategory);
  }

  const source = await loadSourceCatalogue().catch(() => []);
  const pensol = await loadPensolNames();

  if (!categories.length) {
    const names = [
      ...new Set(
        [
          ...source.map((item) => item.categoryName),
          ...pensol.map((item) => item.category),
        ].filter((name): name is string => Boolean(name)),
      ),
    ];
    categories = names.map((name) => ({
      id: `cat-${slugifyCategory(name)}`,
      name,
      slug: slugifyCategory(name),
    }));
  }

  const cableNames = source
    .filter((item) => item.categoryName === "CABLES / WIRES")
    .map((item) => item.name || "");
  const filterNames = source
    .filter((item) => item.categoryName === "FILTERS")
    .map((item) => item.name || "");
  const hasUnclassifiedWaterPumps = source.some(
    (item) =>
      isWaterPumpProduct(item.categoryName, item.name || "") &&
      classifyWaterPumpSegment(item.vehicleTypes || [], item.name || "") === "unclassified",
  );

  return {
    categories,
    ...buildCategoryNavigation(categories, {
      cableNames,
      filterNames,
      hasUnclassifiedWaterPumps,
    }),
  };
}
