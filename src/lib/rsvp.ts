import type { EventRow, GuestRow } from "@/db/schema";

export type Tally = { yes: number; no: number; maybe: number; heads: number };

/**
 * `heads` is what the host actually cares about: bodies through the door,
 * companions included. Only a "yes" contributes.
 */
export function tally(list: GuestRow[]): Tally {
  const result: Tally = { yes: 0, no: 0, maybe: 0, heads: 0 };
  for (const guest of list) {
    result[guest.status] += 1;
    if (guest.status === "yes") result.heads += 1 + guest.plusOnes;
  }
  return result;
}

export function findMine(list: GuestRow[], guestKey: string | null): GuestRow | null {
  if (!guestKey) return null;
  return list.find((guest) => guest.guestKey === guestKey) ?? null;
}

export function rsvpClosed(event: EventRow, now = Date.now()): boolean {
  return event.rsvpDeadline !== null && now > event.rsvpDeadline;
}
