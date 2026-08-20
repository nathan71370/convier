import type { RsvpStatus } from "../db/schema";
import { normalizeEmail } from "./whitelist.ts";

export type LegacyGuest = {
  id: string;
  eventId: string;
  email: string | null;
  name: string;
  photo: string | null;
  status: RsvpStatus;
  plusOnes: number;
  message: string | null;
  createdAt: number;
  updatedAt: number;
  migratedAt: number | null;
};

export type Promotion = {
  users: { email: string; name: string | null; photo: string | null }[];
  rsvps: {
    guestId: string;
    email: string;
    eventId: string;
    status: RsvpStatus;
    plusOnes: number;
    message: string | null;
    createdAt: number;
    updatedAt: number;
  }[];
  /** Rows carrying no usable address: left in place, never destroyed. */
  skipped: string[];
};

/**
 * Decides what a promotion pass would write, without touching the database.
 * Keeping it pure is what makes the interesting cases — duplicate addresses,
 * two answers to one event, half-filled profiles — cheap to test.
 */
export function planPromotion(rows: LegacyGuest[]): Promotion {
  const profiles = new Map<string, { name: string | null; photo: string | null; at: number }>();
  const answers = new Map<string, Promotion["rsvps"][number]>();
  const skipped: string[] = [];

  for (const row of rows) {
    if (row.migratedAt !== null) continue;

    const email = row.email ? normalizeEmail(row.email) : null;
    if (!email) {
      skipped.push(row.id);
      continue;
    }

    // Latest non-empty value wins, field by field: an older row may hold a
    // photo the newer one lacks.
    const current = profiles.get(email) ?? { name: null, photo: null, at: -1 };
    const fresher = row.updatedAt >= current.at;
    profiles.set(email, {
      name: row.name && fresher ? row.name : current.name,
      photo: row.photo && fresher ? row.photo : current.photo,
      at: Math.max(current.at, row.updatedAt),
    });

    const key = `${email} ${row.eventId}`;
    const existing = answers.get(key);
    if (!existing || row.updatedAt > existing.updatedAt) {
      answers.set(key, {
        guestId: row.id,
        email,
        eventId: row.eventId,
        status: row.status,
        plusOnes: row.plusOnes,
        message: row.message,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    }
  }

  return {
    users: [...profiles].map(([email, p]) => ({ email, name: p.name, photo: p.photo })),
    rsvps: [...answers.values()],
    skipped,
  };
}
