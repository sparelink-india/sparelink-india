import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCategoryNavigation,
  classifyWaterPumpSegment,
  discoverNamedTypes,
  FILTER_TYPE_DEFS,
  flattenNavHrefs,
  resolveCategoryRoute,
  slugifyCategory,
  type CatalogueCategory,
} from "./category-navigation";

const SOURCE = [
  "ACCELERATOR PEDAL",
  "ARM REST HANDLE",
  "BATTERY TERMINALS",
  "BONNET HANDLE",
  "BONNET HINGES",
  "BONNET LOCK",
  "BONNET OPENER",
  "BRAKE LININGS",
  "BRAKE SHOES",
  "BUMPER BRACKETS",
  "BUMPER CORNERS",
  "CABLES / WIRES",
  "CHANNELS / GUIDE RAILS",
  "CLAMPS",
  "CONNECTOR",
  "DALA HANDLES",
  "DICKEY / TRUNKLID LOCKS",
  "DICKEY SHOCKER / GAS SPRINGS",
  "DOOR HINGES",
  "DOOR LATCH ASSY.",
  "DOOR LOCK",
  "DOOR LOCK KIT",
  "DOOR LOCK KNOB",
  "DOOR LOCK W/KEYS",
  "DOOR STOPPER",
  "DOOR STRIKER",
  "FAN",
  "FENDER LININGS",
  "FILTERS",
  "FOG LAMP",
  "FOG LAMP COVER",
  "FOOT STEP",
  "FRONT GRILLS",
  "FUEL TANK CAP",
  "FUEL TANK LOCKS",
  "FUEL TANK NECK",
  "GEAR LEVER BOOT",
  "GEAR LEVER KNOBS",
  "GLOVE BOX / DASH BOARD LOCKS",
  "GRAB HANDLE",
  "HAND THROTTLE",
  "HEAD LIGHT BEZEL",
  "HEAD LIGHTS",
  "HORNS",
  "IGNITION / STEERING LOCKS",
  "INNER PULL HANDLE",
  "INSIDE DOOR HANDLE",
  "INSIDE MIRROR",
  "LICENSE NUMBER PLATES",
  "LINKAGE ROD",
  "METER",
  "MOTORS",
  "MUD GUARD FLAP",
  "OUTSIDE DOOR HANDLE",
  "POWER WINDOW SWITCHES",
  "QUARTER GLASS FRAME",
  "RADIATOR CAP",
  "RATCHET TIE DOWN",
  "RELAY",
  "RODS",
  "ROOF HANDLE",
  "SASH",
  "SEAT BELTS",
  "SEAT RECLINERS",
  "SENSOR",
  "SHOCK ABSORBERS / SHOCKERS",
  "SIDE MIRROR BRACKET",
  "SIDE MIRROR RODS",
  "SIDE VIEW MIRROR",
  "SPRINGS",
  "STEERING WHEELS",
  "STEPNEY BRACKETS",
  "SUB MIRROR",
  "SUNSHADE BRACKET",
  "SUNVISOR",
  "SWITCHES",
  "Uncategorized",
  "UREA / ADBLUE TANK CAP",
  "WHEEL CAP",
  "WINDOW LOCK",
  "WINDOW REGULATOR ASSY",
  "WINDOW REGULATOR HANDLES",
  "WIPER ARM",
  "WIPER BLADE",
  "WIPER LINKAGE",
];

const PENSOL = [
  "Agriculture & Tractor Oils",
  "AXLE & TRANSMISSION OIL",
  "Brake Fluid",
  "Circulating Oil",
  "CNG Engine Oils",
  "Compressor Oil",
  "Coolant",
  "Diesel Engine Oil",
  "Diesel Engine Oils",
  "DIESEL EXHAUST FLUID",
  "Gear Oil",
  "Gear Oils",
  "Greases",
  "Hydraulic Oil",
  "Metal Working Fluid",
  "Mini CV Engine Oils",
  "MOTORBIKE OILS",
  "Others",
  "Passenger Car Engine Oils",
  "Quenching Oil",
  "Refrigeration Oil",
  "Rock Drill Oil",
  "Rust Preventive Oil",
  "Special Grade Machinery Oil",
  "Spinning Oil",
  "Thermic Fluid",
];

function cats(names: string[]): CatalogueCategory[] {
  return names.map((name) => ({
    id: `id-${slugifyCategory(name)}`,
    name,
    slug: slugifyCategory(name),
  }));
}

describe("category navigation grouping", () => {
  it("groups every active catalogue category without dropping any", () => {
    const all = cats([...SOURCE, ...PENSOL]);
    const { groups, coverage } = buildCategoryNavigation(all, {
      cableNames: [
        "ACCELERATOR CABLE EECO",
        "CLUTCH CABLE ASSY",
        "GEAR CABLE",
        "BRAKE CABLE",
        "BONNET CABLE 407",
        "DOOR CABLE",
        "SPEEDOMETER CABLE",
      ],
      filterNames: [
        "OIL FILTER SWIFT",
        "AIR FILTER I20",
        "FUEL FILTER",
        "CABIN FILTER",
        "CNG FILTER FOR SUPER CARRY",
        "WATER SEPARATOR (WHITE)",
      ],
    });

    const reachable = new Set(
      groups.flatMap((group) =>
        group.children.filter((child) => child.kind === "category").map((child) => child.name),
      ),
    );
    for (const name of [...SOURCE, ...PENSOL]) {
      assert.equal(reachable.has(name), true, `missing ${name}`);
    }
    assert.equal(coverage.total, all.length);
    assert.equal(coverage.unmapped.includes("METER"), true);
    assert.equal(coverage.unmapped.includes("Others"), true);
    assert.equal(coverage.emptyGroups.length, 0);

    const ids = groups.map((group) => group.id);
    assert.equal(ids[0], "lubricants");
    assert.equal(ids[1], "window-regulator");
    assert.equal(ids[2], "water-pump-assy");
    assert.equal(ids[3], "bonnet");
    assert.equal(ids[4], "cables");
    assert.equal(ids[5], "filters");

    const water = groups.find((group) => group.id === "water-pump-assy");
    assert.ok(water);
    assert.ok(water.children.some((child) => child.name === "Heavy Commercial Vehicle"));
    assert.ok(water.children.some((child) => child.name === "Passenger Vehicle"));
    assert.ok(water.children.some((child) => child.name === "Agriculture"));
    assert.ok(water.children.some((child) => child.name === "Earthmover"));

    const cables = groups.find((group) => group.id === "cables");
    assert.ok(cables?.children.some((child) => child.name === "Accelerator Cable"));
    assert.ok(cables?.children.some((child) => child.name === "Clutch Cable"));
    assert.ok(!cables?.children.some((child) => child.name === "Throttle Cable"));

    const filters = groups.find((group) => group.id === "filters");
    assert.ok(filters?.children.some((child) => child.name === "Oil Filter"));
    assert.ok(!filters?.children.some((child) => child.name === "Hydraulic Filter"));
  });

  it("collapses case-insensitive duplicate catalogue labels in navigation", () => {
    const all = cats(["FILTERS", "Filters", "ENGINE PARTS", "Engine Parts", "LUBRICANTS", "Lubricants"]);
    const { groups } = buildCategoryNavigation(all);
    const namesFor = (id: string) =>
      (groups.find((group) => group.id === id)?.children ?? [])
        .filter((child) => child.kind === "category")
        .map((child) => child.name);
    assert.deepEqual(namesFor("filters"), ["FILTERS"]);
    assert.deepEqual(namesFor("engine"), ["ENGINE PARTS"]);
    assert.deepEqual(namesFor("lubricants"), ["LUBRICANTS"]);
  });

  it("discovers only types present in actual names", () => {
    const types = discoverNamedTypes(
      ["AIR FILTER I20", "OIL FILTER SWIFT"],
      FILTER_TYPE_DEFS,
      "Other Filters",
      "other-filters",
    );
    assert.deepEqual(
      types.map((item) => item.slug),
      ["oil-filter", "air-filter"],
    );
  });

  it("does not guess mixed JCB applications as a vehicle segment", () => {
    assert.equal(
      classifyWaterPumpSegment(["JCB AGRICULTURE & MACHINERY"], "WATER PUMP ASSY"),
      "unclassified",
    );
    assert.equal(
      classifyWaterPumpSegment(["TATA TRUCK"], "WATER PUMP ASSY"),
      "heavy-commercial-vehicle",
    );
    assert.equal(
      classifyWaterPumpSegment(["MARUTI SUZUKI (CAR)"], "WATER PUMP"),
      "passenger-vehicle",
    );
  });

  it("resolves dedicated category and type routes", () => {
    const all = cats(["FILTERS", "CABLES / WIRES"]);
    const { groups } = buildCategoryNavigation(all, {
      filterNames: ["OIL FILTER SWIFT"],
      cableNames: ["ACCELERATOR CABLE EECO"],
    });
    const oil = resolveCategoryRoute(["filters", "oil-filter"], all, groups);
    assert.ok(oil);
    assert.equal(oil.categoryName, "FILTERS");
    assert.equal(oil.nameContains, "Oil Filter");
    const filters = resolveCategoryRoute(["filters"], all, groups);
    assert.equal(filters?.categoryName, "FILTERS");
    const water = resolveCategoryRoute(["water-pump-assy", "agriculture"], all, groups);
    assert.equal(water?.segment, "agriculture");
    assert.ok(flattenNavHrefs(groups).includes("/category/filters/oil-filter"));
  });
});
