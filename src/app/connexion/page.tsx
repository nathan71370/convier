import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Connexion — Convier", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // Already signed in: sending them back to the form would just be a dead end.
  if (await currentUser()) redirect(target);

  return (
    <div className="mx-auto w-full max-w-md px-6 pt-12 pb-24 sm:px-10 lg:pt-20">
      <div className="animate-rise">
        <p className="eyebrow text-vermilion">✦ Connexion</p>
        <h1
          className="font-title mt-4 text-[clamp(2rem,6vw,3rem)] leading-[1.05] tracking-[-0.02em]"
          style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
        >
          Qui es-tu ?
        </h1>
      </div>

      <div className="card animate-rise mt-8 p-7 sm:p-9" style={{ animationDelay: "120ms" }}>
        <LoginForm next={target} />
      </div>
    </div>
  );
}
