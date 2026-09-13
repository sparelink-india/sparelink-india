import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getDb } from "./lib/db";
import {
  part,
  partCategory,
  vehicle,
  dealer,
  dealerListing,
  inventory,
  cartItem,
  orderItem,
  firm,
} from "./drizzle/schema";
import { eq, ilike, or } from "drizzle-orm";

async function main() {
  const db = getDb();

  console.log("=== 1. CHECK TEST LISTING listing-test-oil-filter-001 ===");
  const testListing = await db
    .select()
    .from(dealerListing)
    .where(eq(dealerListing.id, "listing-test-oil-filter-001"));
  console.log("Test Listing:", JSON.stringify(testListing, null, 2));

  if (testListing.length > 0) {
    const testInv = await db
      .select()
      .from(inventory)
      .where(eq(inventory.dealerListingId, "listing-test-oil-filter-001"));
    console.log("Test Inventory:", JSON.stringify(testInv, null, 2));

    const testCartItems = await db
      .select()
      .from(cartItem)
      .where(eq(cartItem.dealerListingId, "listing-test-oil-filter-001"));
    console.log("Test CartItems referencing listing:", JSON.stringify(testCartItems, null, 2));

    const testOrderItems = await db
      .select()
      .from(orderItem)
      .where(eq(orderItem.dealerListingId, "listing-test-oil-filter-001"));
    console.log("Test OrderItems referencing listing:", JSON.stringify(testOrderItems, null, 2));
  }

  console.log("\n=== 2. ALL FIRMS ===");
  const firms = await db.select().from(firm);
  console.log("Firms:", JSON.stringify(firms, null, 2));

  console.log("\n=== 3. ALL DEALERS ===");
  const dealers = await db.select().from(dealer);
  console.log("Dealers:", JSON.stringify(dealers, null, 2));

  console.log("\n=== 4. SEARCH PARTS FOR WATER PUMP / BOLERO / 113 / HANDLE ===");
  const searchParts = await db
    .select()
    .from(part)
    .where(
      or(
        ilike(part.name, "%water%"),
        ilike(part.name, "%pump%"),
        ilike(part.name, "%bolero%"),
        ilike(part.name, "%handle%"),
        ilike(part.name, "%door%"),
        ilike(part.partNumber, "%113%"),
        ilike(part.partNumber, "%bolero%"),
        ilike(part.partNumber, "%pump%"),
        ilike(part.partNumber, "%water%")
      )
    );
  console.log("Matching Parts in DB:", JSON.stringify(searchParts, null, 2));

  console.log("\n=== 5. ALL PARTS IN DB ===");
  const allParts = await db.select().from(part);
  console.log(`Total parts in DB: ${allParts.length}`);
  allParts.forEach((p) => {
    console.log(`- [${p.id}] PartNo: "${p.partNumber}" | Name: "${p.name}" | Brand: "${p.brand}" | Cat: "${p.categoryId}"`);
  });

  console.log("\n=== 6. ALL VEHICLES IN DB ===");
  const allVehicles = await db.select().from(vehicle);
  console.log(`Total vehicles in DB: ${allVehicles.length}`);
  allVehicles.forEach((v) => {
    console.log(`- [${v.id}] ${v.make} ${v.model} (${v.variant || ""})`);
  });

  console.log("\n=== 7. ALL CATEGORIES IN DB ===");
  const allCats = await db.select().from(partCategory);
  console.log(`Categories:`, JSON.stringify(allCats, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
