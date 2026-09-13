import dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../lib/db");
  const {
    partCategory,
    part,
    vehicle,
    partVehicleCompatibility,
    user,
    dealer,
    dealerListing,
    inventory,
    firm,
  } = await import("./schema");
  const { eq } = await import("drizzle-orm");

  const db = getDb();

  const categories = [
    {
      id: "cat-engine",
      name: "Engine",
      slug: "engine",
      description: "Engine and internal engine components",
    },
    {
      id: "cat-transmission",
      name: "Transmission",
      slug: "transmission",
      description: "Transmission and drivetrain components",
    },
    {
      id: "cat-brakes",
      name: "Brakes",
      slug: "brakes",
      description: "Brake system components",
    },
    {
      id: "cat-suspension",
      name: "Suspension",
      slug: "suspension",
      description: "Suspension and steering components",
    },
    {
      id: "cat-electrical",
      name: "Electrical",
      slug: "electrical",
      description: "Electrical and electronic components",
    },
    {
      id: "cat-filters",
      name: "Filters",
      slug: "filters",
      description: "Air, oil, fuel and cabin filters",
    },
    {
      id: "cat-cooling",
      name: "Cooling",
      slug: "cooling",
      description: "Cooling system components",
    },
    {
      id: "cat-body",
      name: "Body",
      slug: "body",
      description: "Body and exterior components",
    },
  ];

  await db.insert(partCategory).values(categories).onConflictDoNothing();

  const parts = [
    {
      id: "part-oil-filter-001",
      partNumber: "SL-OIL-FILTER-001",
      name: "Engine Oil Filter",
      description: "Spin-on engine oil filter for passenger vehicles",
      brand: "SpareLink",
      categoryId: "cat-filters",
    },
    {
      id: "part-air-filter-001",
      partNumber: "SL-AIR-FILTER-001",
      name: "Engine Air Filter",
      description: "Replacement engine air filter",
      brand: "SpareLink",
      categoryId: "cat-filters",
    },
    {
      id: "part-brake-pad-001",
      partNumber: "SL-BRAKE-PAD-001",
      name: "Front Brake Pad Set",
      description: "Front axle disc brake pad set",
      brand: "SpareLink",
      categoryId: "cat-brakes",
    },
    {
      id: "part-clutch-kit-001",
      partNumber: "SL-CLUTCH-KIT-001",
      name: "Clutch Kit",
      description: "Clutch plate, pressure plate and release bearing kit",
      brand: "SpareLink",
      categoryId: "cat-transmission",
    },
    {
      id: "part-radiator-001",
      partNumber: "SL-RADIATOR-001",
      name: "Engine Radiator",
      description: "Engine cooling radiator assembly",
      brand: "SpareLink",
      categoryId: "cat-cooling",
    },
    {
      id: "part-spark-plug-001",
      partNumber: "SL-SPARK-PLUG-001",
      name: "Spark Plug",
      description: "Petrol engine replacement spark plug",
      brand: "SpareLink",
      categoryId: "cat-engine",
    },
    {
      id: "part-battery-001",
      partNumber: "SL-BATTERY-001",
      name: "12V Car Battery",
      description: "12V automotive starter battery",
      brand: "SpareLink",
      categoryId: "cat-electrical",
    },
    {
      id: "part-front-strut-001",
      partNumber: "SL-FRONT-STRUT-001",
      name: "Front Suspension Strut",
      description: "Front suspension strut assembly",
      brand: "SpareLink",
      categoryId: "cat-suspension",
    },
  ];

  await db.insert(part).values(parts).onConflictDoNothing();

  const vehicles = [
    {
      id: "vehicle-maruti-swift",
      make: "Maruti Suzuki",
      model: "Swift",
      variant: "1.2 Petrol",
    },
    {
      id: "vehicle-maruti-baleno",
      make: "Maruti Suzuki",
      model: "Baleno",
      variant: "1.2 Petrol",
    },
    {
      id: "vehicle-hyundai-i20",
      make: "Hyundai",
      model: "i20",
      variant: "1.2 Petrol",
    },
    {
      id: "vehicle-tata-nexon",
      make: "Tata",
      model: "Nexon",
      variant: "1.2 Petrol",
    },
    {
      id: "vehicle-hyundai-creta",
      make: "Hyundai",
      model: "Creta",
      variant: "1.5 Petrol",
    },
  ];

  await db.insert(vehicle).values(vehicles).onConflictDoNothing();

  const compatibility = [
    {
      id: "compat-oil-filter-swift",
      partId: "part-oil-filter-001",
      vehicleId: "vehicle-maruti-swift",
    },
    {
      id: "compat-oil-filter-baleno",
      partId: "part-oil-filter-001",
      vehicleId: "vehicle-maruti-baleno",
    },
    {
      id: "compat-air-filter-swift",
      partId: "part-air-filter-001",
      vehicleId: "vehicle-maruti-swift",
    },
    {
      id: "compat-air-filter-baleno",
      partId: "part-air-filter-001",
      vehicleId: "vehicle-maruti-baleno",
    },
    {
      id: "compat-air-filter-i20",
      partId: "part-air-filter-001",
      vehicleId: "vehicle-hyundai-i20",
    },
    {
      id: "compat-brake-pad-swift",
      partId: "part-brake-pad-001",
      vehicleId: "vehicle-maruti-swift",
    },
    {
      id: "compat-brake-pad-i20",
      partId: "part-brake-pad-001",
      vehicleId: "vehicle-hyundai-i20",
    },
    {
      id: "compat-clutch-swift",
      partId: "part-clutch-kit-001",
      vehicleId: "vehicle-maruti-swift",
    },
    {
      id: "compat-clutch-baleno",
      partId: "part-clutch-kit-001",
      vehicleId: "vehicle-maruti-baleno",
    },
    {
      id: "compat-radiator-nexon",
      partId: "part-radiator-001",
      vehicleId: "vehicle-tata-nexon",
    },
    {
      id: "compat-spark-swift",
      partId: "part-spark-plug-001",
      vehicleId: "vehicle-maruti-swift",
    },
    {
      id: "compat-spark-baleno",
      partId: "part-spark-plug-001",
      vehicleId: "vehicle-maruti-baleno",
    },
    {
      id: "compat-spark-i20",
      partId: "part-spark-plug-001",
      vehicleId: "vehicle-hyundai-i20",
    },
    {
      id: "compat-battery-swift",
      partId: "part-battery-001",
      vehicleId: "vehicle-maruti-swift",
    },
    {
      id: "compat-battery-baleno",
      partId: "part-battery-001",
      vehicleId: "vehicle-maruti-baleno",
    },
    {
      id: "compat-battery-i20",
      partId: "part-battery-001",
      vehicleId: "vehicle-hyundai-i20",
    },
    {
      id: "compat-front-strut-swift",
      partId: "part-front-strut-001",
      vehicleId: "vehicle-maruti-swift",
    },
    {
      id: "compat-front-strut-i20",
      partId: "part-front-strut-001",
      vehicleId: "vehicle-hyundai-i20",
    },
  ];

  await db
    .insert(partVehicleCompatibility)
    .values(compatibility)
    .onConflictDoNothing();

  // Seed test users for dealers
  const dealerUsers = [
    {
      id: "user-admin",
      name: "Admin User",
      email: "admin@sparelink.local",
      phoneNumber: "+919999999999",
      phoneNumberVerified: true,
      role: "admin" as const,
      emailVerified: true,
    },
    {
      id: "user-dealer-1",
      name: "Rajesh Patel",
      email: "rajesh@sparepartner.local",
      phoneNumber: "+919876543210",
      phoneNumberVerified: true,
      role: "dealer" as const,
      emailVerified: true,
    },
    {
      id: "user-dealer-2",
      name: "Priya Singh",
      email: "priya@sparepartner.local",
      phoneNumber: "+919876543211",
      phoneNumberVerified: true,
      role: "dealer" as const,
      emailVerified: true,
    },
    {
      id: "user-dealer-3",
      name: "Amit Kumar",
      email: "amit@sparepartner.local",
      phoneNumber: "+919876543212",
      phoneNumberVerified: true,
      role: "dealer" as const,
      emailVerified: true,
    },
  ];

  await db.insert(user).values(dealerUsers).onConflictDoNothing();

  // Seed dealers
  const dealers = [
    {
      id: "dealer-001",
      userId: "user-dealer-1",
      businessName: "Rajesh Auto Parts",
      gstin: "18AAQPR1234K1Z0",
      phone: "+919876543210",
      email: "rajesh@sparepartner.local",
      address: "123 Main Street",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380001",
    },
    {
      id: "dealer-002",
      userId: "user-dealer-2",
      businessName: "Priya's Car Components",
      gstin: "06AABPU1234K1Z0",
      phone: "+919876543211",
      email: "priya@sparepartner.local",
      address: "456 Market Road",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    },
    {
      id: "dealer-003",
      userId: "user-dealer-3",
      businessName: "Kumar Automotive Supply",
      gstin: "27AABCT1234K1Z0",
      phone: "+919876543212",
      email: "amit@sparepartner.local",
      address: "789 Industrial Area",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560001",
    },
  ];

  await db.insert(dealer).values(dealers).onConflictDoNothing();

  // Get firm ID for Ambaji Traders
  const ambajiTradersFirm = await db
    .select({ id: firm.id })
    .from(firm)
    .where(eq(firm.code, "AMB"))
    .limit(1);

  const ambajiTradersFirmId = ambajiTradersFirm[0]?.id || "firm-ambaji-traders";

  // Seed dealer listings with firm assignments
  // Engine Oil Filter → Ambaji Traders for all dealers
  const dealerListings = [
    // Engine Oil Filter to all dealers, assigned to Ambaji Traders
    {
      id: "listing-oil-filter-dealer-1",
      dealerId: "dealer-001",
      partId: "part-oil-filter-001",
      firmId: ambajiTradersFirmId,
      sku: "SKU-OIL-001-R1",
      pricePaise: 45000, // ₹450
      mrpPaise: 60000, // ₹600
      status: "active" as const,
    },
    {
      id: "listing-oil-filter-dealer-2",
      dealerId: "dealer-002",
      partId: "part-oil-filter-001",
      firmId: ambajiTradersFirmId,
      sku: "SKU-OIL-001-P2",
      pricePaise: 48000, // ₹480
      mrpPaise: 60000, // ₹600
      status: "active" as const,
    },
    {
      id: "listing-oil-filter-dealer-3",
      dealerId: "dealer-003",
      partId: "part-oil-filter-001",
      firmId: ambajiTradersFirmId,
      sku: "SKU-OIL-001-A3",
      pricePaise: 46000, // ₹460
      mrpPaise: 60000, // ₹600
      status: "active" as const,
    },
    // Other parts (Air Filter, Brake Pad, etc.) - no firm assignment yet (for now)
    {
      id: "listing-air-filter-dealer-1",
      dealerId: "dealer-001",
      partId: "part-air-filter-001",
      firmId: null,
      sku: "SKU-AIR-001-R1",
      pricePaise: 35000, // ₹350
      mrpPaise: 50000, // ₹500
      status: "active" as const,
    },
    {
      id: "listing-brake-pad-dealer-2",
      dealerId: "dealer-002",
      partId: "part-brake-pad-001",
      firmId: null,
      sku: "SKU-BRAKE-001-P2",
      pricePaise: 250000, // ₹2500
      mrpPaise: 350000, // ₹3500
      status: "active" as const,
    },
  ];

  await db.insert(dealerListing).values(dealerListings).onConflictDoNothing();

  // Seed inventory for listings
  const inventoryRecords = dealerListings.map((listing) => ({
    id: randomUUID(),
    dealerListingId: listing.id,
    quantity: 50, // 50 units in stock for each
  }));

  await db.insert(inventory).values(inventoryRecords).onConflictDoNothing();

  console.log(`Seeded ${dealerUsers.length} dealer users.`);
  console.log(`Seeded ${dealers.length} dealers.`);
  console.log(`Seeded ${dealerListings.length} dealer listings.`);
  console.log(`Seeded ${inventoryRecords.length} inventory records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
