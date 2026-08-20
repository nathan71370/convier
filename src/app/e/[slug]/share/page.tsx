import Link from "next/link";
import { CopyField } from "@/components/CopyField";
import { formatRange } from "@/lib/datetime";
import { requireOwnedEvent } from "@/lib/events";
import { requireUser } from "@/lib/session";
import { getOrigin } from "@/lib/origin";

export const metadata = { robots: { index: false } };

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser(`/e/${slug}/share`);
  const [event, origin] = await Promise.all([
    requireOwnedEvent(slug, user.id),
    getOrigin(),
  ]);

  const publicUrl = `${origin}/e/${event.slug}`;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pt-10 pb-24 sm:px-10 lg:pt-16">
      <div className="animate-rise">
        <p className="eyebrow text-vermilion">✦ C&apos;est créé</p>
        <h1
          className="font-title mt-4 text-[clamp(2rem,5vw,3rem)] leading-[1.05] tracking-[-0.02em] text-balance"
          style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
        >
          {event.title}
        </h1>
        <p className="text-ink-soft mt-3 first-letter:uppercase">
          {formatRange(event.startsAt, event.endsAt, event.allDay, event.timezone)}
        </p>
      </div>

      <div
        className="card animate-rise mt-10 space-y-8 p-7 sm:p-9"
        style={{ animationDelay: "120ms" }}
      >
        <CopyField
          label="Lien à partager"
          hint="envoie-le à tes invités"
          value={publicUrl}
        />

        <p className="text-ink-soft border-(--rule) border-l-2 py-1 pl-4 text-sm text-pretty">
          Tes invités devront se connecter avec leur adresse e-mail pour
          répondre. C&apos;est ce qui leur permet de corriger leur réponse depuis
          un autre appareil, et à toi de savoir qui vient vraiment.
        </p>

        <div className="border-(--rule) flex flex-wrap gap-3 border-t pt-6">
          <Link href={`/e/${event.slug}`} className="btn-ink">
            Voir la page de l&apos;événement
          </Link>
          <Link href={`/e/${event.slug}/manage`} className="btn-quiet">
            Modifier
          </Link>
        </div>
      </div>
    </div>
  );
}
