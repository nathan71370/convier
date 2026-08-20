import type { EventRow, RsvpStatus } from "../db/schema";

/** A row joined with its account: the list only ever shows profile identity. */
export type RsvpView = {
  id: string;
  userId: string;
  name: string;
  photo: string | null;
  status: RsvpStatus;
  plusOnes: number;
  message: string | null;
  hostEditedAt: number | null;
};

export type Tally = { yes: number; no: number; maybe: number; heads: number };

/**
 * `heads` is what the host actually cares about: bodies through the door,
 * companions included. Only a "yes" contributes.
 */
export function tally(list: RsvpView[]): Tally {
  const result: Tally = { yes: 0, no: 0, maybe: 0, heads: 0 };
  for (const rsvp of list) {
    result[rsvp.status] += 1;
    if (rsvp.status === "yes") result.heads += 1 + rsvp.plusOnes;
  }
  return result;
}

export function findMine(list: RsvpView[], userId: string | null): RsvpView | null {
  if (!userId) return null;
  return list.find((rsvp) => rsvp.userId === userId) ?? null;
}

export function rsvpClosed(event: EventRow, now = Date.now()): boolean {
  return event.rsvpDeadline !== null && now > event.rsvpDeadline;
}
