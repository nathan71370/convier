import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { defaultStartLocal, epochToLocalInput, zonedToEpoch, zoneOffset } from "./zoned.ts";

const PARIS = "Europe/Paris";
const TOKYO = "Asia/Tokyo";
const UTC = "UTC";

describe("zonedToEpoch", () => {
  test("reads a wall clock in the zone it belongs to", () => {
    // 19:30 in Paris in September is UTC+2.
    assert.equal(zonedToEpoch("2026-09-12T19:30", PARIS), Date.UTC(2026, 8, 12, 17, 30));
    assert.equal(zonedToEpoch("2026-09-12T19:30", UTC), Date.UTC(2026, 8, 12, 19, 30));
    assert.equal(zonedToEpoch("2026-09-12T19:30", TOKYO), Date.UTC(2026, 8, 12, 10, 30));
  });

  test("uses winter offset for a winter date in the same zone", () => {
    // Paris is UTC+1 in January, UTC+2 in July: the offset is not a constant.
    assert.equal(zonedToEpoch("2026-01-12T19:30", PARIS), Date.UTC(2026, 0, 12, 18, 30));
    assert.equal(zonedToEpoch("2026-07-12T19:30", PARIS), Date.UTC(2026, 6, 12, 17, 30));
  });

  test("resolves times on both sides of a daylight-saving change", () => {
    // Paris springs forward at 02:00 on 29 March 2026.
    assert.equal(zonedToEpoch("2026-03-29T01:30", PARIS), Date.UTC(2026, 2, 29, 0, 30));
    assert.equal(zonedToEpoch("2026-03-29T03:30", PARIS), Date.UTC(2026, 2, 29, 1, 30));
    // Autumn: the clocks go back at 03:00 on 25 October 2026.
    assert.equal(zonedToEpoch("2026-10-25T04:00", PARIS), Date.UTC(2026, 9, 25, 3, 0));
  });

  test("treats a date-only value as midnight in the zone", () => {
    assert.equal(zonedToEpoch("2026-09-12", PARIS), Date.UTC(2026, 8, 11, 22, 0));
  });

  test("rejects anything that is not a date input value", () => {
    for (const value of ["", "demain", "12/09/2026", "2026-09-12T19:30:00Z"]) {
      assert.equal(zonedToEpoch(value, PARIS), null);
    }
  });
});

describe("epochToLocalInput", () => {
  test("round-trips a wall clock through an instant and back", () => {
    for (const local of ["2026-01-12T19:30", "2026-07-12T19:30", "2026-10-25T04:00"]) {
      const ts = zonedToEpoch(local, PARIS)!;
      assert.equal(epochToLocalInput(ts, PARIS, false), local);
    }
  });

  test("shows the same instant differently in two zones", () => {
    const ts = Date.UTC(2026, 8, 12, 17, 30);
    assert.equal(epochToLocalInput(ts, PARIS, false), "2026-09-12T19:30");
    assert.equal(epochToLocalInput(ts, TOKYO, false), "2026-09-13T02:30");
  });

  test("drops the time portion for an all-day event", () => {
    assert.equal(epochToLocalInput(Date.UTC(2026, 8, 12, 17, 30), PARIS, true), "2026-09-12");
  });

  test("renders midnight as hour 00, never 24", () => {
    const ts = zonedToEpoch("2026-09-12", PARIS)!;
    assert.equal(epochToLocalInput(ts, PARIS, false), "2026-09-12T00:00");
  });
});

describe("zoneOffset", () => {
  test("reports the zone's shift from UTC at that instant", () => {
    assert.equal(zoneOffset(Date.UTC(2026, 0, 12), PARIS), 3600_000);
    assert.equal(zoneOffset(Date.UTC(2026, 6, 12), PARIS), 2 * 3600_000);
    assert.equal(zoneOffset(Date.UTC(2026, 6, 12), UTC), 0);
  });
});

describe("defaultStartLocal", () => {
  test("proposes 19:30 a week from now, in the host's zone", () => {
    assert.equal(defaultStartLocal(Date.UTC(2026, 8, 12, 10, 0), PARIS), "2026-09-19T19:30");
  });

  test("rolls over the month and year correctly", () => {
    assert.equal(defaultStartLocal(Date.UTC(2026, 11, 28, 10, 0), UTC), "2027-01-04T19:30");
  });
});
