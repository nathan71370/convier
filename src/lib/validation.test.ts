import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { eventInputSchema, fieldErrors, rsvpInputSchema } from "./validation.ts";

const START = Date.UTC(2026, 8, 12, 17, 30);

const validEvent = {
  title: "Crémaillère",
  description: null,
  location: null,
  hostName: null,
  startsAt: START,
  endsAt: null,
  rsvpDeadline: null,
  allDay: false,
  timezone: "Europe/Paris",
};

describe("eventInputSchema", () => {
  test("accepts a title and a start date alone", () => {
    assert.equal(eventInputSchema.safeParse(validEvent).success, true);
  });

  test("rejects an empty or whitespace-only title", () => {
    for (const title of ["", "   "]) {
      const result = eventInputSchema.safeParse({ ...validEvent, title });
      assert.equal(result.success, false);
      assert.equal(fieldErrors(result.error!).title, "Donne un titre à ton événement");
    }
  });

  test("rejects an end that precedes the start", () => {
    const result = eventInputSchema.safeParse({
      ...validEvent,
      endsAt: START - 3600_000,
    });
    assert.equal(result.success, false);
    assert.equal(fieldErrors(result.error!).endsAt, "La fin doit suivre le début");
  });

  test("rejects a reply deadline set after the event", () => {
    const result = eventInputSchema.safeParse({
      ...validEvent,
      rsvpDeadline: START + 3600_000,
    });
    assert.equal(result.success, false);
    assert.equal(
      fieldErrors(result.error!).rsvpDeadline,
      "La date limite doit précéder l'événement",
    );
  });

  test("treats blank optional dates as absent rather than as zero", () => {
    const result = eventInputSchema.safeParse({
      ...validEvent,
      endsAt: "",
      rsvpDeadline: "",
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.endsAt, null);
    assert.equal(result.data?.rsvpDeadline, null);
  });

  test("trims text and stores empty optional fields as null", () => {
    const result = eventInputSchema.safeParse({
      ...validEvent,
      title: "  Crémaillère  ",
      location: "   ",
    });
    assert.equal(result.data?.title, "Crémaillère");
    assert.equal(result.data?.location, null);
  });
});

describe("rsvpInputSchema", () => {
  const valid = { name: "Camille", status: "yes", plusOnes: 2, message: null, photo: null };

  test("accepts a name and a status", () => {
    assert.equal(rsvpInputSchema.safeParse(valid).success, true);
  });

  test("requires a name and a known status", () => {
    assert.equal(rsvpInputSchema.safeParse({ ...valid, name: " " }).success, false);
    assert.equal(rsvpInputSchema.safeParse({ ...valid, status: "peut-etre" }).success, false);
  });

  test("clamps a nonsensical companion count back to zero", () => {
    assert.equal(rsvpInputSchema.safeParse({ ...valid, plusOnes: -3 }).data?.plusOnes, 0);
    assert.equal(rsvpInputSchema.safeParse({ ...valid, plusOnes: 999 }).data?.plusOnes, 0);
    assert.equal(rsvpInputSchema.safeParse({ ...valid, plusOnes: "3" }).data?.plusOnes, 3);
  });

  test("accepts a base64 image data URL", () => {
    const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    assert.equal(rsvpInputSchema.safeParse({ ...valid, photo }).data?.photo, photo);
  });

  test("drops anything that is not an inline image", () => {
    for (const photo of [
      "https://evil.test/tracker.gif",
      "data:text/html;base64,PHNjcmlwdD4=",
      "javascript:alert(1)",
    ]) {
      assert.equal(rsvpInputSchema.safeParse({ ...valid, photo }).data?.photo, null);
    }
  });

  test("drops an oversized photo instead of storing it", () => {
    const photo = `data:image/jpeg;base64,${"A".repeat(200_001)}`;
    assert.equal(rsvpInputSchema.safeParse({ ...valid, photo }).data?.photo, null);
  });
});

describe("fieldErrors", () => {
  test("keeps only the first message per field", () => {
    const result = eventInputSchema.safeParse({ ...validEvent, title: "" });
    const errors = fieldErrors(result.error!);
    assert.equal(Object.keys(errors).length, 1);
  });
});
