import { createEvent } from "./actions";
import { EventForm } from "@/components/EventForm";
import { requestTime } from "@/lib/clock";
import { defaultStartLocal } from "@/lib/zoned";

const STEPS = [
  ["01", "Décris l'événement", "Un titre, une date. Le reste est facultatif."],
  ["02", "Partage le lien", "Message, groupe, QR code — peu importe."],
  ["03", "Regarde les réponses", "Prénoms, photos et présences en direct."],
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;

  // Rendered in the server's zone; the browser swaps in its own on mount and
  // posts it back, so the hour the host sees is the hour that gets stored.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const initial = {
    title: "",
    description: "",
    location: "",
    hostName: "",
    startLocal: defaultStartLocal(requestTime(), timezone),
    endLocal: "",
    deadlineLocal: "",
    allDay: false,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-10">
      {deleted ? (
        <p className="border-(--rule) text-ink-soft animate-rise mb-8 border-l-2 py-2 pl-4 text-sm">
          L&apos;événement a été supprimé. Le lien partagé ne mène plus nulle part.
        </p>
      ) : null}

      <section className="animate-rise grid gap-12 pt-10 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:pt-20">
        <div className="max-w-xl">
          <p className="eyebrow">Invitations · sans compte · sans e-mail</p>
          <h1
            className="font-title mt-5 text-[clamp(2.6rem,7vw,4.4rem)] leading-[0.95] tracking-[-0.02em]"
            style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
          >
            Un lien.
            <br />
            <span className="text-vermilion italic">Tout le monde</span>
            <br />
            répond.
          </h1>
          <p className="text-ink-soft mt-7 text-lg leading-relaxed text-balance">
            Crée ton événement en trente secondes, envoie le lien. Tes invités
            mettent leur prénom, une photo s&apos;ils veulent, disent s&apos;ils
            viennent — et l&apos;ajoutent à leur agenda d&apos;un clic.
          </p>

          <ol className="mt-12 space-y-6">
            {STEPS.map(([number, title, detail], index) => (
              <li
                key={number}
                className="animate-rise flex gap-5"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <span
                  className="font-title text-vermilion/70 text-2xl leading-none"
                  aria-hidden
                >
                  {number}
                </span>
                <span>
                  <strong className="block font-bold">{title}</strong>
                  <span className="text-ink-soft text-sm">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div
          className="card animate-rise p-7 sm:p-9"
          style={{ animationDelay: "160ms" }}
        >
          <EventForm
            action={createEvent}
            submitLabel="Créer l'événement"
            initial={initial}
            timezone={timezone}
            detectTimezone
          />
        </div>
      </section>
    </div>
  );
}
