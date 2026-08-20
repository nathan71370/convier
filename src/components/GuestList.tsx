import { Avatar } from "./Avatar";
import type { RsvpStatus } from "@/db/schema";
import type { RsvpView, Tally } from "@/lib/rsvp";

const GROUPS: { status: RsvpStatus; title: string; tint: string }[] = [
  { status: "yes", title: "Présents", tint: "var(--color-yes)" },
  { status: "maybe", title: "Peut-être", tint: "var(--color-maybe)" },
  { status: "no", title: "Absents", tint: "var(--color-no)" },
];

export function GuestList({
  guests,
  counts,
  mineId,
}: {
  guests: RsvpView[];
  counts: Tally;
  mineId?: string | null;
}) {
  if (guests.length === 0) {
    return (
      <p className="text-ink-soft border-(--rule) border-l-2 py-2 pl-4 text-sm">
        Personne n&apos;a encore répondu. Sois le premier à te prononcer.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <p className="font-title text-2xl leading-snug">
        <span className="text-yes font-semibold">{counts.heads}</span>
        <span className="text-ink-soft">
          {counts.heads > 1 ? " personnes attendues" : " personne attendue"}
        </span>
        {counts.maybe > 0 ? (
          <span className="text-ink-faint text-base">
            {" "}
            · {counts.maybe} en attente
          </span>
        ) : null}
      </p>

      {GROUPS.map(({ status, title, tint }) => {
        const group = guests.filter((guest) => guest.status === status);
        if (group.length === 0) return null;

        return (
          <section key={status}>
            <h3 className="eyebrow flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ background: tint }}
              />
              {title} · {group.length}
            </h3>
            <ul className="mt-4 space-y-3.5">
              {group.map((guest) => (
                <li key={guest.id} className="flex items-start gap-3.5">
                  <Avatar
                    name={guest.name}
                    photo={guest.photo}
                    ring={guest.id === mineId ? tint : undefined}
                  />
                  <div className="min-w-0 pt-0.5">
                    <p className="leading-tight font-bold">
                      {guest.name}
                      {guest.plusOnes > 0 ? (
                        <span className="text-ink-soft font-normal">
                          {" "}
                          + {guest.plusOnes}
                        </span>
                      ) : null}
                      {guest.id === mineId ? (
                        <span className="eyebrow ml-2 align-middle">toi</span>
                      ) : null}
                    </p>
                    {guest.message ? (
                      <p className="text-ink-soft text-sm text-pretty">
                        « {guest.message} »
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
