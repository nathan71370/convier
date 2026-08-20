import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarActions } from "@/components/CalendarActions";
import { GuestList } from "@/components/GuestList";
import { RsvpForm } from "@/components/RsvpForm";
import { countdown, formatRange, zoneLabel } from "@/lib/datetime";
import { getEventBySlug, hostName, listRsvps } from "@/lib/events";
import { findMine, rsvpClosed, tally } from "@/lib/rsvp";
import { requestTime } from "@/lib/clock";
import { requireUser } from "@/lib/session";
import { getOrigin } from "@/lib/origin";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Événement introuvable" };

  return {
    title: `${event.title} — Convier`,
    description: formatRange(event.startsAt, event.endsAt, event.allDay, event.timezone),
    openGraph: {
      title: event.title,
      description: [
        formatRange(event.startsAt, event.endsAt, event.allDay, event.timezone),
        event.location,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  // Every page needs a session: the guest list is exactly the sort of thing a
  // stranger with a leaked link should not read.
  const user = await requireUser(`/e/${slug}`);

  const [guests, host, origin] = await Promise.all([
    listRsvps(event.id),
    hostName(event),
    getOrigin(),
  ]);

  const counts = tally(guests);
  const mine = findMine(guests, user.id);
  const now = requestTime();
  const closed = rsvpClosed(event, now);
  const past = event.startsAt < now;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10">
      <article className="animate-rise pt-8 lg:pt-14">
        <p className="eyebrow">
          {past ? "Événement passé" : countdown(event.startsAt, now)}
          {host ? ` · organisé par ${host}` : ""}
        </p>

        <h1
          className="font-title mt-4 text-[clamp(2.2rem,6vw,3.8rem)] leading-[1.02] tracking-[-0.02em] text-balance"
          style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
        >
          {event.title}
        </h1>

        <dl className="border-(--rule) mt-8 grid gap-x-10 gap-y-5 border-t pt-6 sm:grid-cols-2">
          <div>
            <dt className="eyebrow">Quand</dt>
            <dd className="mt-1 text-lg leading-snug first-letter:uppercase">
              {formatRange(event.startsAt, event.endsAt, event.allDay, event.timezone)}
              <span className="text-ink-faint block text-sm">
                heure de {zoneLabel(event.timezone)}
              </span>
            </dd>
          </div>
          {event.location ? (
            <div>
              <dt className="eyebrow">Où</dt>
              <dd className="mt-1 text-lg leading-snug">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="decoration-vermilion/50 hover:decoration-vermilion underline decoration-1 underline-offset-4"
                >
                  {event.location}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

        {event.description ? (
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-pretty whitespace-pre-line">
            {event.description}
          </p>
        ) : null}

        <div className="mt-8">
          <p className="eyebrow mb-2.5">Ajouter à mon calendrier</p>
          <CalendarActions event={event} origin={origin} />
        </div>
      </article>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <section
          className="card animate-rise p-7 sm:p-9"
          style={{ animationDelay: "120ms" }}
        >
          {closed ? (
            <div>
              <h2 className="font-title text-2xl">Les réponses sont closes</h2>
              <p className="text-ink-soft mt-2">
                La date limite fixée par l&apos;organisateur est passée. La liste
                ci-contre reste consultable.
              </p>
            </div>
          ) : past ? (
            <div>
              <h2 className="font-title text-2xl">C&apos;est déjà passé</h2>
              <p className="text-ink-soft mt-2">
                Cet événement a eu lieu. Tu peux encore voir qui était de la partie.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-title text-2xl leading-snug">
                {mine ? `Bon retour, ${mine.name}` : "Tu viens ?"}
              </h2>
              <p className="text-ink-soft mt-1 mb-7 text-sm">
                {mine
                  ? "Tu peux changer ta réponse autant de fois que tu veux."
                  : "Pas de compte à créer. Trente secondes, promis."}
              </p>
              <RsvpForm slug={event.slug} mine={mine} profile={user} />
            </>
          )}
        </section>

        <section className="animate-rise" style={{ animationDelay: "200ms" }}>
          <h2 className="eyebrow mb-5">Qui sera là</h2>
          <GuestList guests={guests} counts={counts} mineId={mine?.id} />
        </section>
      </div>

      <p className="text-ink-faint mt-16 text-sm">
        <Link href="/" className="hover:text-vermilion underline underline-offset-4">
          Organiser ton propre événement
        </Link>
      </p>
    </div>
  );
}
