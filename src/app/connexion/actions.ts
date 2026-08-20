"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  bumpAttempts,
  consumeCode,
  countRecentCodes,
  createLoginCode,
  findLatestCode,
  findOrCreateUser,
} from "@/lib/auth-store";
import { generateCode, checkCode } from "@/lib/otp";
import { sendLoginCode } from "@/lib/mailer";
import { exceedsCaps } from "@/lib/ratelimit";
import { endSession, startSession } from "@/lib/session";
import { normalizeEmail } from "@/lib/whitelist";

export type LoginState = {
  step: "email" | "code";
  email?: string;
  error?: string;
};

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

/** Only same-site paths are honoured, so the login page cannot be aimed elsewhere. */
function safeNext(raw: string): string {
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

async function callerIp(): Promise<string | null> {
  const head = await headers();
  const forwarded = head.get("x-forwarded-for");
  return forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null;
}

export async function requestCode(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const email = normalizeEmail(text(form, "email"));
  if (!email) return { step: "email", error: "Cette adresse ne ressemble pas à une adresse e-mail." };

  const ip = await callerIp();
  const counts = await countRecentCodes(email, ip);

  // A throttled request answers exactly like an accepted one. Announcing the
  // cap would only help someone work around it, and whoever asked legitimately
  // already has a code in their inbox.
  if (!exceedsCaps(counts)) {
    const code = generateCode();
    await createLoginCode(email, code, ip);
    try {
      await sendLoginCode(email, code);
    } catch (cause) {
      console.error("[otp] envoi impossible", cause);
      return { step: "email", error: "L'e-mail n'a pas pu partir. Réessaie dans un instant." };
    }
  }

  return { step: "code", email };
}

export async function verifyCode(
  _prev: LoginState,
  form: FormData,
): Promise<LoginState> {
  const email = normalizeEmail(text(form, "email"));
  const submitted = text(form, "code").replace(/\D/g, "");
  const next = safeNext(text(form, "next"));

  if (!email) return { step: "email", error: "Reprends depuis ton adresse." };

  const row = await findLatestCode(email);
  const verdict = row ? checkCode(row, submitted, Date.now()) : "invalide";

  if (!row || verdict !== "ok") {
    if (row) await bumpAttempts(row.id);
    return { step: "code", email, error: "Code incorrect ou expiré." };
  }

  await consumeCode(row.id);
  const user = await findOrCreateUser(email);
  await startSession(user.id);

  redirect(next);
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/connexion");
}
