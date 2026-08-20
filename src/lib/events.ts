import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, ready } from "@/db";
import { type EventRow, events, rsvps, users } from "@/db/schema";
import type { RsvpView } from "./rsvp";

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  await ready();
  const [row] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  return row ?? null;
}

/**
 * An event somebody else owns answers exactly like one that does not exist.
 * Distinguishing the two would confirm the slug to a stranger.
 */
export async function requireOwnedEvent(slug: string, userId: string): Promise<EventRow> {
  const event = await getEventBySlug(slug);
  if (!event || event.hostUserId !== userId) notFound();
  return event;
}

export async function listRsvps(eventId: string): Promise<RsvpView[]> {
  await ready();
  const rows = await db
    .select({
      id: rsvps.id,
      userId: rsvps.userId,
      name: users.name,
      photo: users.photo,
      status: rsvps.status,
      plusOnes: rsvps.plusOnes,
      message: rsvps.message,
      hostEditedAt: rsvps.hostEditedAt,
    })
    .from(rsvps)
    .innerJoin(users, eq(users.id, rsvps.userId))
    .where(eq(rsvps.eventId, eventId))
    .orderBy(asc(rsvps.createdAt));

  return rows.map((row) => ({ ...row, name: row.name ?? "Sans nom" }));
}

export async function hostName(event: EventRow): Promise<string | null> {
  if (!event.hostUserId) return null;
  await ready();
  const [row] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, event.hostUserId))
    .limit(1);
  return row?.name ?? null;
}

export async function listHostedEvents(userId: string): Promise<EventRow[]> {
  await ready();
  return db
    .select()
    .from(events)
    .where(eq(events.hostUserId, userId))
    .orderBy(desc(events.startsAt));
}

/** Events the person answered, split by whether they have happened yet. */
export async function listAnsweredEvents(
  userId: string,
  now: number,
): Promise<{ upcoming: EventRow[]; past: EventRow[] }> {
  await ready();
  const select = (where: ReturnType<typeof and>) =>
    db
      .select({ event: events })
      .from(rsvps)
      .innerJoin(events, eq(events.id, rsvps.eventId))
      .where(where);

  const upcoming = await select(and(eq(rsvps.userId, userId), gte(events.startsAt, now)));
  const past = await select(and(eq(rsvps.userId, userId), lt(events.startsAt, now)));

  return {
    upcoming: upcoming.map((r) => r.event).sort((a, b) => a.startsAt - b.startsAt),
    past: past.map((r) => r.event).sort((a, b) => b.startsAt - a.startsAt),
  };
}
