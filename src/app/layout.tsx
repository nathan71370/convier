import type { Metadata } from "next";
import { Fraunces, Karla } from "next/font/google";
import Link from "next/link";
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
  title: "Convier — invitations sans compte",
  description:
    "Crée un événement, partage un lien. Tes invités répondent en dix secondes et l'ajoutent à leur calendrier.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variables must sit on :root — the theme's --font-title and
    // --font-sans resolve them there, not on <body>.
    <html lang="fr" className={`${fraunces.variable} ${karla.variable}`}>
      <body className="antialiased">
        <div className="relative z-10 flex min-h-dvh flex-col">
          <header className="px-6 pt-7 pb-2 sm:px-10">
            <Link
              href="/"
              className="font-title inline-flex items-baseline gap-2 text-[1.35rem] tracking-tight"
              style={{ fontVariationSettings: "'SOFT' 40, 'WONK' 1" }}
            >
              <span className="text-vermilion">✦</span>
              <span className="font-semibold">Convier</span>
            </Link>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="eyebrow px-6 py-8 text-center sm:px-10">
            Aucun compte · aucune adresse e-mail · juste un lien
          </footer>
        </div>
      </body>
    </html>
  );
}
