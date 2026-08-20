import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { EventRow, RsvpStatus } from "../db/schema.ts";
import type { RsvpView } from "./rsvp.ts";
import { findMine, rsvpClosed, tally } from "./rsvp.ts";

let seq = 0;

function guest(status: RsvpStatus, plusOnes = 0, userId = `u-${++seq}`): RsvpView {
  return {
    id: `r-${seq}`,
    userId,
    name: "Invité",
    photo: null,
    status,
    plusOnes,
    message: null,
    hostEditedAt: null,
  };
}

const event = (rsvpDeadline: number | null): EventRow => ({
  id: "evt",
  slug: "s",
  title: "T",
  description: null,
  location: null,
  startsAt: 0,
  endsAt: null,
  allDay: false,
  timezone: "Europe/Paris",
  hostUserId: null,
  immichAlbumId: null,
  immichShareUrl: null,
  rsvpDeadline,
  createdAt: 0,
});

describe("tally", () => {
  test("counts an empty guest list as all zeroes", () => {
    assert.deepEqual(tally([]), { yes: 0, no: 0, maybe: 0, heads: 0 });
  });

  test("counts each guest plus their companions", () => {
    const result = tally([guest("yes", 2), guest("yes"), guest("maybe"), guest("no")]);
    assert.deepEqual(result, { yes: 2, no: 1, maybe: 1, heads: 4 });
  });

  test("never counts heads for maybe or no, even with companions attached", () => {
    assert.equal(tally([guest("maybe", 5), guest("no", 3)]).heads, 0);
  });
});

describe("findMine", () => {
  const list = [guest("yes", 0, "mine"), guest("no", 0, "theirs")];

  test("rend la ligne du compte connecté", () => {
    assert.equal(findMine(list, "mine")?.userId, "mine");
  });

  test("rend null pour un compte inconnu ou absent", () => {
    assert.equal(findMine(list, "someone-else"), null);
    assert.equal(findMine(list, null), null);
  });
});

describe("rsvpClosed", () => {
  test("stays open when the host set no deadline", () => {
    assert.equal(rsvpClosed(event(null), 9e12), false);
  });

  test("closes only once the deadline is behind us", () => {
    assert.equal(rsvpClosed(event(1_000), 999), false);
    assert.equal(rsvpClosed(event(1_000), 1_000), false, "the deadline instant still counts");
    assert.equal(rsvpClosed(event(1_000), 1_001), true);
  });
});
