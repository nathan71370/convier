import { asc, eq } from "drizzle-orm";
import { db, ready } from "@/db";
import { type EventRow, events, type GuestRow, guests } from "@/db/schema";

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  await ready();
  const [row] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  return row ?? null;
}

/**
 * Admin pages resolve by token alone and then check the slug matches. A wrong
 * token and a missing event are indistinguishable to the caller by design.
 */
export async function getEventByAdminToken(token: string): Promise<EventRow | null> {
  await ready();
  if (!token) return null;
  const [row] = await db
    .select()
    .from(events)
    .where(eq(events.adminToken, token))
    .limit(1);
  return row ?? null;
}

export async function listGuests(eventId: string): Promise<GuestRow[]> {
  await ready();
  return db
    .select()
    .from(guests)
    .where(eq(guests.eventId, eventId))
    .orderBy(asc(guests.createdAt));
}
