"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, ready } from "@/db";
import { events, guests } from "@/db/schema";
import { getEventByAdminToken, getEventBySlug } from "@/lib/events";
import { rsvpClosed } from "@/lib/rsvp";
import { ensureGuestKey } from "@/lib/guest";
import { newAdminToken, newId, slugify } from "@/lib/ids";
import { eventInputSchema, fieldErrors, rsvpInputSchema } from "@/lib/validation";
import { zonedToEpoch } from "@/lib/zoned";

export type FormState = { errors?: Record<string, string>; ok?: boolean };

const empty: FormState = {};

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function optional(form: FormData, key: string): string | null {
  const value = text(form, key).trim();
  return value || null;
}

/**
 * The form posts wall-clock strings plus the zone they were written in; the
 * database wants instants. Doing the conversion here — not in the browser —
 * is what lets a host in one zone edit an event pinned to another.
 */
function eventFieldsFrom(form: FormData, fallbackZone: string) {
  const timezone = text(form, "timezone").trim() || fallbackZone;
  const toEpoch = (key: string) => {
    const local = optional(form, key);
    return local === null ? null : zonedToEpoch(local, timezone);
  };

  return {
    title: text(form, "title"),
    description: optional(form, "description"),
    location: optional(form, "location"),
    hostName: optional(form, "hostName"),
    startsAt: toEpoch("startsAt"),
    endsAt: toEpoch("endsAt"),
    rsvpDeadline: toEpoch("rsvpDeadline"),
    allDay: form.get("allDay") === "on",
    timezone,
  };
}

export async function createEvent(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = eventInputSchema.safeParse(eventFieldsFrom(form, "Europe/Paris"));

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await ready();
  const adminToken = newAdminToken();
  let slug = slugify(parsed.data.title);

  for (let attempt = 0; ; attempt++) {
    try {
      await db.insert(events).values({
        id: newId(),
        slug,
        adminToken,
        ...parsed.data,
      });
      break;
    } catch (error) {
      // Slug collisions are rare but not impossible; retry with a fresh suffix.
      if (attempt >= 3) throw error;
      slug = slugify(parsed.data.title);
    }
  }

  redirect(`/e/${slug}/share?t=${adminToken}`);
}

export async function submitRsvp(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const slug = text(form, "slug");
  const event = await getEventBySlug(slug);
  if (!event) return { errors: { form: "Cet événement n'existe plus." } };

  if (rsvpClosed(event)) {
    return { errors: { form: "Les réponses sont closes pour cet événement." } };
  }

  const parsed = rsvpInputSchema.safeParse({
    name: text(form, "name"),
    status: text(form, "status"),
    plusOnes: text(form, "plusOnes") || 0,
    message: optional(form, "message"),
    photo: optional(form, "photo"),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const guestKey = await ensureGuestKey();
  const now = Date.now();
  const { name, status, plusOnes, message, photo } = parsed.data;
  // "no" carries no head count: keep the data honest rather than trusting the
  // form to have hidden the field.
  const heads = status === "yes" ? plusOnes : 0;

  await db
    .insert(guests)
    .values({
      id: newId(),
      eventId: event.id,
      guestKey,
      name,
      status,
      plusOnes: heads,
      message,
      photo,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [guests.eventId, guests.guestKey],
      set: { name, status, plusOnes: heads, message, photo, updatedAt: now },
    });

  revalidatePath(`/e/${slug}`);
  return empty;
}

export async function withdrawRsvp(form: FormData): Promise<void> {
  const slug = text(form, "slug");
  const event = await getEventBySlug(slug);
  if (!event || rsvpClosed(event)) return;

  const guestKey = await ensureGuestKey();
  await db
    .delete(guests)
    .where(and(eq(guests.eventId, event.id), eq(guests.guestKey, guestKey)));

  revalidatePath(`/e/${slug}`);
}

export async function updateEvent(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const token = text(form, "token");
  const event = await getEventByAdminToken(token);
  if (!event) return { errors: { form: "Lien d'administration invalide." } };

  const parsed = eventInputSchema.safeParse(eventFieldsFrom(form, event.timezone));

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await db.update(events).set(parsed.data).where(eq(events.id, event.id));

  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/manage`);
  return { ok: true };
}

export async function deleteEvent(form: FormData): Promise<void> {
  const token = text(form, "token");
  const event = await getEventByAdminToken(token);
  if (!event) redirect("/");

  await db.delete(guests).where(eq(guests.eventId, event.id));
  await db.delete(events).where(eq(events.id, event.id));

  redirect("/?deleted=1");
}
