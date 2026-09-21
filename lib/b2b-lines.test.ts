import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeInclusiveLine,
  stripClientMoneyFields,
  sumDocumentTotals,
} from "./b2b-lines";

describe("computeInclusiveLine", () => {
  it("splits GST inclusive totals for 18%", () => {
    const line = computeInclusiveLine({
      unitInclusivePaise: 11800,
      quantity: 2,
      gstRate: 18,
    });
    assert.equal(line.lineTotalPaise, 23600);
    assert.equal(line.lineTaxablePaise, 20000);
    assert.equal(line.lineGstPaise, 3600);
  });

  it("handles zero quantity and clamps negative unit", () => {
    const line = computeInclusiveLine({
      unitInclusivePaise: -50,
      quantity: 0,
      gstRate: 18,
    });
    assert.equal(line.lineTotalPaise, 0);
    assert.equal(line.lineGstPaise, 0);
    assert.equal(line.unitInclusivePaise, 0);
  });
});

describe("sumDocumentTotals", () => {
  it("aggregates taxable, gst, and total", () => {
    const a = computeInclusiveLine({
      unitInclusivePaise: 11800,
      quantity: 1,
      gstRate: 18,
    });
    const b = computeInclusiveLine({
      unitInclusivePaise: 10500,
      quantity: 1,
      gstRate: 5,
    });
    const totals = sumDocumentTotals([
      { lineTotalPaise: a.lineTotalPaise, lineGstPaise: a.lineGstPaise },
      { lineTotalPaise: b.lineTotalPaise, lineGstPaise: b.lineGstPaise },
    ]);
    assert.equal(totals.totalPaise, a.lineTotalPaise + b.lineTotalPaise);
    assert.equal(totals.gstPaise, a.lineGstPaise + b.lineGstPaise);
    assert.equal(totals.subtotalPaise, totals.totalPaise - totals.gstPaise);
  });
});

describe("stripClientMoneyFields", () => {
  it("removes price/gst fields but keeps quantity, listing id, and firmId", () => {
    const cleaned = stripClientMoneyFields({
      dealerListingId: "listing-1",
      quantity: 3,
      pricePaise: 999,
      unitPricePaise: 999,
      gstRate: 28,
      firmId: "firm-ambaji-traders",
      notes: "keep",
    });
    assert.equal(cleaned.dealerListingId, "listing-1");
    assert.equal(cleaned.quantity, 3);
    assert.equal(cleaned.notes, "keep");
    assert.equal(cleaned.firmId, "firm-ambaji-traders");
    assert.equal("pricePaise" in cleaned, false);
    assert.equal("gstRate" in cleaned, false);
  });
});
