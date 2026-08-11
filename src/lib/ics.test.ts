import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { EventRow } from "../db/schema.ts";
import { buildIcs, googleCalendarUrl } from "./ics.ts";

const base: EventRow = {
  id: "evt_123",
  slug: "cremaillere-x7k2p",
  adminToken: "secret",
  title: "Crémaillère",
  description: null,
  location: null,
  startsAt: Date.UTC(2026, 8, 12, 17, 30),
  endsAt: Date.UTC(2026, 8, 12, 22, 0),
  allDay: false,
  timezone: "Europe/Paris",
  hostName: null,
  rsvpDeadline: null,
  createdAt: 0,
};

const ORIGIN = "https://convier.test";
const lines = (ics: string) => ics.split("\r\n");
const line = (ics: string, prefix: string) =>
  lines(ics).find((entry) => entry.startsWith(prefix));

describe("buildIcs", () => {
  test("emits CRLF-terminated VEVENT with UTC stamps", () => {
    const ics = buildIcs(base, ORIGIN);
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    assert.equal(line(ics, "DTSTART"), "DTSTART:20260912T173000Z");
    assert.equal(line(ics, "DTEND"), "DTEND:20260912T220000Z");
  });

  test("keeps the UID stable so re-downloads update rather than duplicate", () => {
    assert.equal(line(buildIcs(base, ORIGIN), "UID:"), "UID:evt_123@event-scheduler");
    const moved = buildIcs({ ...base, startsAt: base.startsAt + 3600_000 }, ORIGIN);
    assert.equal(line(moved, "UID:"), "UID:evt_123@event-scheduler");
  });

  test("escapes commas, semicolons and newlines in text values", () => {
    const ics = buildIcs(
      { ...base, title: "Apéro, dîner; puis film", description: "Ligne 1\nLigne 2" },
      ORIGIN,
    );
    assert.equal(line(ics, "SUMMARY"), "SUMMARY:Apéro\\, dîner\\; puis film");
    assert.ok(line(ics, "DESCRIPTION")?.includes("Ligne 1\\nLigne 2"));
  });

  test("folds long lines at 75 octets without splitting a character", () => {
    const ics = buildIcs({ ...base, title: "é".repeat(120) }, ORIGIN);
    for (const entry of lines(ics)) {
      assert.ok(
        Buffer.byteLength(entry, "utf8") <= 75,
        `line exceeds 75 octets: ${entry}`,
      );
    }
    // Unfolding must give the title back intact, accents and all.
    const unfolded = ics.replace(/\r\n /g, "");
    assert.ok(unfolded.includes(`SUMMARY:${"é".repeat(120)}`));
  });

  test("uses DATE values and an exclusive end for all-day events", () => {
    const ics = buildIcs(
      { ...base, allDay: true, endsAt: Date.UTC(2026, 8, 12, 0, 0) },
      ORIGIN,
    );
    assert.equal(line(ics, "DTSTART"), "DTSTART;VALUE=DATE:20260912");
    assert.equal(line(ics, "DTEND"), "DTEND;VALUE=DATE:20260913");
  });

  test("falls back to a two-hour block when no end time was given", () => {
    const ics = buildIcs({ ...base, endsAt: null }, ORIGIN);
    assert.equal(line(ics, "DTEND"), "DTEND:20260912T193000Z");
  });

  test("carries the reply link and omits LOCATION when there is none", () => {
    const ics = buildIcs(base, ORIGIN);
    assert.ok(line(ics, "DESCRIPTION")?.includes(`${ORIGIN}/e/${base.slug}`));
    assert.equal(line(ics, "LOCATION"), undefined);
  });
});

describe("googleCalendarUrl", () => {
  test("builds a TEMPLATE link with a UTC range", () => {
    const url = new URL(googleCalendarUrl({ ...base, location: "12 rue des Lilas" }, ORIGIN));
    assert.equal(url.searchParams.get("action"), "TEMPLATE");
    assert.equal(url.searchParams.get("text"), "Crémaillère");
    assert.equal(url.searchParams.get("dates"), "20260912T173000Z/20260912T220000Z");
    assert.equal(url.searchParams.get("location"), "12 rue des Lilas");
  });

  test("spans whole days for all-day events", () => {
    const url = new URL(googleCalendarUrl({ ...base, allDay: true, endsAt: null }, ORIGIN));
    assert.equal(url.searchParams.get("dates"), "20260912/20260913");
  });
});
