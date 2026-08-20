"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, ready } from "@/db";
import { events, rsvps } from "@/db/schema";
import { fillProfileGaps } from "@/lib/auth-store";
import { getEventBySlug, requireOwnedEvent } from "@/lib/events";
import { newId, slugify } from "@/lib/ids";
import { createSharedAlbum, immichConfigured, readImmichConfig } from "@/lib/immich";
import { rsvpClosed } from "@/lib/rsvp";
import { requireUser } from "@/lib/session";
import { eventInputSchema, fieldErrors, rsvpInputSchema } from "@/lib/validation";
import { canCreateEvents } from "@/lib/whitelist";
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
  const user = await requireUser("/");

  // Checked here and not only in the page: hiding the form is a convenience,
  // this is the check that holds when the action is replayed directly.
  if (!canCreateEvents(user.email)) {
    return { errors: { form: "Ton adresse n'est pas autorisée à créer un événement." } };
  }

  const parsed = eventInputSchema.safeParse(eventFieldsFrom(form, "Europe/Paris"));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await ready();
  let slug = slugify(parsed.data.title);

  for (let attempt = 0; ; attempt++) {
    try {
      await db.insert(events).values({
        id: newId(),
        slug,
        hostUserId: user.id,
        ...parsed.data,
      });
      break;
    } catch (error) {
      // Slug collisions are rare but not impossible; retry with a fresh suffix.
      if (attempt >= 3) throw error;
      slug = slugify(parsed.data.title);
    }
  }

  if (form.get("immichAlbum") === "on") {
    await attachAlbum(slug, parsed.data.title, parsed.data.description);
  }

  redirect(`/e/${slug}/share`);
}

/**
 * Deliberately after the event exists and never inside the same failure path:
 * Immich being down must not stop anyone from inviting people. A failure is
 * recoverable from the manage page, where the same call is one button away.
 */
async function attachAlbum(
  slug: string,
  title: string,
  description: string | null,
): Promise<string | null> {
  try {
    const album = await createSharedAlbum(title, description ?? `Photos de « ${title} »`);
    await db
      .update(events)
      .set({ immichAlbumId: album.albumId, immichShareUrl: album.shareUrl })
      .where(eq(events.slug, slug));
    return null;
  } catch (cause) {
    console.error("[immich] création de l'album impossible", cause);
    return cause instanceof Error ? cause.message : "Création de l'album impossible.";
  }
}

/** Retry button on the manage page, and the way to add an album afterwards. */
export async function createAlbumForEvent(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const slug = text(form, "slug");
  const user = await requireUser(`/e/${slug}/manage`);
  const event = await requireOwnedEvent(slug, user.id);

  if (!immichConfigured(readImmichConfig())) {
    return { errors: { form: "Immich n'est pas configuré sur ce serveur." } };
  }
  if (event.immichShareUrl) return { ok: true };

  const failure = await attachAlbum(event.slug, event.title, event.description);
  if (failure) return { errors: { form: failure } };

  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/manage`);
  return { ok: true };
}

export async function submitRsvp(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const slug = text(form, "slug");
  const user = await requireUser(`/e/${slug}`);

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

  const now = Date.now();
  const { name, status, plusOnes, message, photo } = parsed.data;
  // "no" carries no head count: keep the data honest rather than trusting the
  // form to have hidden the field.
  const heads = status === "yes" ? plusOnes : 0;

  // Identity lives on the account, so answering also seeds an empty profile —
  // which is what makes the second invitation ask for nothing.
  await fillProfileGaps(user, name, photo);

  await db
    .insert(rsvps)
    .values({
      id: newId(),
      eventId: event.id,
      userId: user.id,
      status,
      plusOnes: heads,
      message,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [rsvps.eventId, rsvps.userId],
      set: { status, plusOnes: heads, message, updatedAt: now },
    });

  revalidatePath(`/e/${slug}`);
  return empty;
}

export async function withdrawRsvp(form: FormData): Promise<void> {
  const slug = text(form, "slug");
  const user = await requireUser(`/e/${slug}`);

  const event = await getEventBySlug(slug);
  if (!event || rsvpClosed(event)) return;

  await db
    .delete(rsvps)
    .where(and(eq(rsvps.eventId, event.id), eq(rsvps.userId, user.id)));

  revalidatePath(`/e/${slug}`);
}

export async function updateEvent(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const slug = text(form, "slug");
  const user = await requireUser(`/e/${slug}/manage`);
  const event = await requireOwnedEvent(slug, user.id);

  const parsed = eventInputSchema.safeParse(eventFieldsFrom(form, event.timezone));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await db.update(events).set(parsed.data).where(eq(events.id, event.id));

  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/manage`);
  return { ok: true };
}

export async function deleteEvent(form: FormData): Promise<void> {
  const slug = text(form, "slug");
  const user = await requireUser(`/e/${slug}/manage`);
  const event = await requireOwnedEvent(slug, user.id);

  await db.delete(rsvps).where(eq(rsvps.eventId, event.id));
  await db.delete(events).where(eq(events.id, event.id));

  redirect("/?deleted=1");
}
