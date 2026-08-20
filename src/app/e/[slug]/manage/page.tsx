import Link from "next/link";
import { deleteEvent, updateEvent } from "@/app/actions";
import { AlbumButton } from "@/components/AlbumButton";
import { CopyField } from "@/components/CopyField";
import { EventForm } from "@/components/EventForm";
import { listRsvps, requireOwnedEvent } from "@/lib/events";
import { requireUser } from "@/lib/session";
import { tally } from "@/lib/rsvp";
import { immichConfigured, readImmichConfig } from "@/lib/immich";
import { getOrigin } from "@/lib/origin";
import { epochToLocalInput } from "@/lib/zoned";

export const metadata = { robots: { index: false } };

export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser(`/e/${slug}/manage`);
  const [event, origin] = await Promise.all([
    requireOwnedEvent(slug, user.id),
    getOrigin(),
  ]);

  const counts = tally(await listRsvps(event.id));

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-10 pb-24 sm:px-10">
      <div className="animate-rise">
        <p className="eyebrow">Administration</p>
        <h1
          className="font-title mt-3 text-[clamp(1.9rem,5vw,2.8rem)] leading-tight tracking-[-0.02em]"
          style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
        >
          {event.title}
        </h1>
        <p className="text-ink-soft mt-2 text-sm">
          {counts.yes} présent{counts.yes > 1 ? "s" : ""} · {counts.maybe} peut-être ·{" "}
          {counts.no} absent{counts.no > 1 ? "s" : ""} ·{" "}
          <span className="text-yes font-semibold">{counts.heads} attendus</span>
        </p>

        <Link href={`/e/${event.slug}`} className="btn-quiet mt-4">
          ← Voir la page que reçoivent tes invités
        </Link>
      </div>

      <div
        className="card animate-rise mt-9 p-7 sm:p-9"
        style={{ animationDelay: "100ms" }}
      >
        <EventForm
          action={updateEvent}
          submitLabel="Enregistrer"
          hidden={{ slug: event.slug }}
          timezone={event.timezone}
          detectTimezone={false}
          initial={{
            title: event.title,
            description: event.description ?? "",
            location: event.location ?? "",
            startLocal: epochToLocalInput(event.startsAt, event.timezone, event.allDay),
            endLocal: event.endsAt
              ? epochToLocalInput(event.endsAt, event.timezone, event.allDay)
              : "",
            deadlineLocal: event.rsvpDeadline
              ? epochToLocalInput(event.rsvpDeadline, event.timezone, false)
              : "",
            allDay: event.allDay,
          }}
        />
      </div>

      <div className="animate-rise mt-10" style={{ animationDelay: "150ms" }}>
        <p className="eyebrow mb-3">Album photo</p>
        {event.immichShareUrl ? (
          <a
            href={event.immichShareUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-quiet"
          >
            Ouvrir l&apos;album ↗
          </a>
        ) : immichConfigured(readImmichConfig()) ? (
          <AlbumButton slug={event.slug} />
        ) : (
          <p className="text-ink-faint text-sm">
            Immich n&apos;est pas configuré sur ce serveur.
          </p>
        )}
      </div>

      <div className="animate-rise mt-10" style={{ animationDelay: "160ms" }}>
        <CopyField
          label="Lien à partager"
          hint="celui que reçoivent tes invités"
          value={`${origin}/e/${event.slug}`}
        />
      </div>

      <form
        action={deleteEvent}
        className="border-(--rule) mt-12 border-t pt-6"
      >
        <input type="hidden" name="slug" value={event.slug} />
        <p className="eyebrow">Zone sans retour</p>
        <p className="text-ink-soft mt-2 mb-4 text-sm text-pretty">
          Supprimer l&apos;événement efface aussi les {counts.yes + counts.maybe + counts.no}{" "}
          réponses reçues. Le lien partagé cessera de fonctionner immédiatement.
        </p>
        <button
          type="submit"
          className="border-no text-no hover:bg-no rounded-full border px-5 py-2.5 text-sm font-bold transition-colors hover:text-white"
        >
          Supprimer définitivement
        </button>
      </form>
    </div>
  );
}
