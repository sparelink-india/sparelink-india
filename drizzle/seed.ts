import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../lib/db");
  const {
    partCategory,
    part,
    vehicle,
    partVehicleCompatibility,
  } = await import("./schema");

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

  console.log(`Seeded ${categories.length} part categories.`);
  console.log(`Seeded ${parts.length} parts.`);
  console.log(`Seeded ${vehicles.length} vehicles.`);
  console.log(`Seeded ${compatibility.length} compatibility mappings.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
