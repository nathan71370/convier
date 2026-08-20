import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { currentUser } from "@/lib/session";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Convier — invitations entre amis",
  description:
    "Crée un événement, partage un lien. Tes invités répondent en dix secondes, retrouvent leur réponse partout et l'ajoutent à leur calendrier.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    // The font variables must sit on :root — the theme's --font-title and
    // --font-sans resolve them there, not on <body>.
    <html lang="fr" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="antialiased">
        <div className="relative z-10 flex min-h-dvh flex-col">
          <header className="flex items-center justify-between gap-4 px-6 pt-7 pb-2 sm:px-10">
            <Link
              href="/"
              className="font-title inline-flex items-baseline gap-2 text-[1.35rem] tracking-tight"
              style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
            >
              <span className="text-vermilion">✦</span>
              <span className="font-semibold">Convier</span>
            </Link>

            {user ? (
              <Link
                href="/profil"
                className="hover:text-vermilion inline-flex items-center gap-2 text-sm font-semibold transition-colors"
              >
                <span className="hidden sm:inline">{user.name ?? "Mon profil"}</span>
                <Avatar name={user.name ?? user.email} photo={user.photo} size={32} />
              </Link>
            ) : (
              <Link href="/connexion" className="text-sm font-semibold underline underline-offset-4">
                Se connecter
              </Link>
            )}
          </header>

          <main className="flex-1">{children}</main>

          <footer className="eyebrow px-6 py-8 text-center sm:px-10">
            Un lien · une adresse e-mail · aucune application à installer
          </footer>
        </div>
      </body>
    </html>
  );
}
