import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-6 pt-16 pb-24 text-center sm:px-10">
      <p className="eyebrow text-vermilion">Erreur 404</p>
      <h1
        className="font-title mt-4 text-[clamp(2rem,6vw,3.2rem)] leading-tight tracking-[-0.02em]"
        style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
      >
        Ce lien ne mène à rien
      </h1>
      <p className="text-ink-soft mt-4 text-pretty">
        L&apos;événement a peut-être été supprimé, ou l&apos;adresse comporte une
        coquille. Vérifie le lien qu&apos;on t&apos;a envoyé.
      </p>
      <Link href="/" className="btn-ink mt-8">
        Créer un événement
      </Link>
    </div>
  );
}
