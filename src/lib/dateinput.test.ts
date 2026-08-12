import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { fromDisplay, isIncorrect, maskDisplay, toDisplay } from "./dateinput.ts";

describe("toDisplay", () => {
  test("renders day before month, never the other way round", () => {
    assert.equal(toDisplay("2026-08-23T02:00", true), "23/08/2026 02:00");
    assert.equal(toDisplay("2026-08-23", false), "23/08/2026");
  });

  test("keeps a date-only value readable when a time is expected", () => {
    assert.equal(toDisplay("2026-08-23", true), "23/08/2026 00:00");
  });

  test("returns empty for an empty or malformed value", () => {
    for (const value of ["", "   ", "23/08/2026", "2026-8-3"]) {
      assert.equal(toDisplay(value, true), "");
    }
  });
});

describe("maskDisplay", () => {
  test("inserts separators as the digits arrive", () => {
    assert.equal(maskDisplay("2", true), "2");
    assert.equal(maskDisplay("23", true), "23/");
    assert.equal(maskDisplay("2308", true), "23/08/");
    assert.equal(maskDisplay("23082026", true), "23/08/2026");
    assert.equal(maskDisplay("2308202602", true), "23/08/2026 02:");
    assert.equal(maskDisplay("230820260230", true), "23/08/2026 02:30");
  });

  test("ignores everything that is not a digit", () => {
    assert.equal(maskDisplay("23/08/2026 02:30", true), "23/08/2026 02:30");
    assert.equal(maskDisplay("abc23xy08!!2026", false), "23/08/2026");
  });

  test("stops at the last digit the format can hold", () => {
    assert.equal(maskDisplay("230820260230999", true), "23/08/2026 02:30");
    assert.equal(maskDisplay("23082026999", false), "23/08/2026");
  });

  test("never emits a time portion for a date-only field", () => {
    assert.equal(maskDisplay("230820260230", false), "23/08/2026");
  });
});

describe("fromDisplay", () => {
  test("round-trips a complete value back to canonical form", () => {
    assert.equal(fromDisplay("23/08/2026 02:30", true), "2026-08-23T02:30");
    assert.equal(fromDisplay("23/08/2026", false), "2026-08-23");
  });

  test("returns null while the value is still being typed", () => {
    assert.equal(fromDisplay("23/08/20", true), null);
    assert.equal(fromDisplay("23/08/2026", true), null);
    assert.equal(fromDisplay("", false), null);
  });

  test("rejects days that do not exist in that month", () => {
    assert.equal(fromDisplay("31/02/2026", false), null);
    assert.equal(fromDisplay("31/04/2026", false), null);
    assert.equal(fromDisplay("00/08/2026", false), null);
  });

  test("accepts 29 February only in a leap year", () => {
    assert.equal(fromDisplay("29/02/2028", false), "2028-02-29");
    assert.equal(fromDisplay("29/02/2027", false), null);
    // 2100 is divisible by 4 but is not a leap year.
    assert.equal(fromDisplay("29/02/2100", false), null);
  });

  test("rejects impossible clock values", () => {
    assert.equal(fromDisplay("23/08/2026 24:00", true), null);
    assert.equal(fromDisplay("23/08/2026 02:60", true), null);
    assert.equal(fromDisplay("23/08/2026 23:59", true), "2026-08-23T23:59");
  });

  test("survives a full round trip through the display format", () => {
    for (const canonical of ["2026-01-01T00:00", "2026-12-31T23:59"]) {
      assert.equal(fromDisplay(toDisplay(canonical, true), true), canonical);
    }
  });
});

describe("isIncorrect", () => {
  test("stays quiet while the field is empty or half typed", () => {
    assert.equal(isIncorrect("", true), false);
    assert.equal(isIncorrect("23/08", true), false);
    assert.equal(isIncorrect("23/08/2026", true), false);
  });

  test("flags a complete but impossible value", () => {
    assert.equal(isIncorrect("31/02/2026", false), true);
    assert.equal(isIncorrect("23/08/2026 25:00", true), true);
  });

  test("stays quiet on a valid value", () => {
    assert.equal(isIncorrect("23/08/2026 02:30", true), false);
  });
});
