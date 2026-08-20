import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { CODE_TTL_MS } from "./otp";

let cached: Transporter | null | undefined;

/**
 * Without SMTP settings the code is logged instead of sent. That keeps the
 * whole login flow walkable — in development, and on a fresh deployment before
 * the mail credentials are in place — rather than dead until configured.
 */
function transport(): Transporter | null {
  if (cached !== undefined) return cached;

  const host = process.env.SMTP_HOST;
  if (!host) {
    cached = null;
    return cached;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  cached = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return cached;
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  const minutes = Math.round(CODE_TTL_MS / 60_000);
  const mailer = transport();

  if (!mailer) {
    console.info(`[otp] ${email} -> ${code} (valable ${minutes} min, SMTP non configuré)`);
    return;
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM ?? `Convier <no-reply@${new URL(process.env.SITE_URL ?? "https://convier.local").hostname}>`,
    to: email,
    subject: `${code} — ton code de connexion Convier`,
    text: [
      `Ton code de connexion est : ${code}`,
      "",
      `Il est valable ${minutes} minutes et ne sert qu'une fois.`,
      "Si tu n'as rien demandé, ignore ce message : personne ne peut se connecter sans ce code.",
    ].join("\n"),
  });
}
