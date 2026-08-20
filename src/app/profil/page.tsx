import Link from "next/link";
import { signOut } from "@/app/connexion/actions";
import { Avatar } from "@/components/Avatar";
import { ProfileForm } from "@/components/ProfileForm";
import type { EventRow } from "@/db/schema";
import { requestTime } from "@/lib/clock";
import { formatRange } from "@/lib/datetime";
import { listAnsweredEvents, listHostedEvents } from "@/lib/events";
import { requireUser } from "@/lib/session";
import { canCreateEvents } from "@/lib/whitelist";

export const metadata = { title: "Mon profil — Convier", robots: { index: false } };

function EventList({ events, empty }: { events: EventRow[]; empty: string }) {
  if (events.length === 0) {
    return <p className="text-ink-faint text-sm">{empty}</p>;
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            href={`/e/${event.slug}`}
            className="border-(--rule) hover:border-ink-faint block border-l-2 py-1 pl-4 transition-colors"
          >
            <span className="block font-bold">{event.title}</span>
            <span className="text-ink-soft text-sm first-letter:uppercase">
              {formatRange(event.startsAt, event.endsAt, event.allDay, event.timezone)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function ProfilePage() {
  const user = await requireUser("/profil");
  const now = requestTime();

  const [hosted, answered] = await Promise.all([
    listHostedEvents(user.id),
    listAnsweredEvents(user.id, now),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-10 pb-24 sm:px-10">
      <div className="animate-rise flex items-center gap-4">
        <Avatar name={user.name ?? user.email} photo={user.photo} size={64} />
        <div className="min-w-0">
          <h1
            className="font-title text-[clamp(1.8rem,5vw,2.5rem)] leading-tight tracking-[-0.02em]"
            style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
          >
            {user.name ?? "Ton profil"}
          </h1>
          <p className="text-ink-soft truncate font-mono text-sm">{user.email}</p>
        </div>
      </div>

      <div className="card animate-rise mt-8 p-7 sm:p-9" style={{ animationDelay: "100ms" }}>
        <ProfileForm name={user.name} photo={user.photo} />
      </div>

      {canCreateEvents(user.email) ? (
        <section className="animate-rise mt-12" style={{ animationDelay: "160ms" }}>
          <h2 className="eyebrow mb-4">Que tu organises · {hosted.length}</h2>
          <EventList events={hosted} empty="Tu n'as encore rien organisé." />
        </section>
      ) : null}

      <section className="animate-rise mt-12" style={{ animationDelay: "200ms" }}>
        <h2 className="eyebrow mb-4">À venir · {answered.upcoming.length}</h2>
        <EventList
          events={answered.upcoming}
          empty="Aucune invitation en attente pour le moment."
        />
      </section>

      <section className="animate-rise mt-12" style={{ animationDelay: "240ms" }}>
        <h2 className="eyebrow mb-4">Déjà passés · {answered.past.length}</h2>
        <EventList events={answered.past} empty="Rien dans tes archives." />
      </section>

      <form action={signOut} className="border-(--rule) mt-14 border-t pt-6">
        <button
          type="submit"
          className="text-ink-soft hover:text-no text-sm font-semibold underline underline-offset-4 transition-colors"
        >
          Me déconnecter
        </button>
      </form>
    </div>
  );
}
