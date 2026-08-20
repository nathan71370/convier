import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;

/** randomInt is drawn from the CSPRNG, unlike Math.random. */
export const generateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

/**
 * The pepper is mandatory. A default would ship in the repository, and anyone
 * reading it could recompute every stored hash from the million possible codes.
 */
function pepper(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET est obligatoire.");
  return secret;
}

export const hashCode = (code: string): string =>
  createHash("sha256").update(`${code}:${pepper()}`).digest("hex");

export type CodeRow = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  consumedAt: number | null;
};

/**
 * One verdict for every refusal. Telling "expired" apart from "wrong" helps
 * nobody but someone guessing, and the legitimate sender already has the code.
 */
export function checkCode(row: CodeRow, submitted: string, now: number): "ok" | "invalide" {
  if (row.consumedAt !== null) return "invalide";
  if (now > row.expiresAt) return "invalide";
  if (row.attempts >= MAX_ATTEMPTS) return "invalide";

  const expected = Buffer.from(row.codeHash, "hex");
  const actual = Buffer.from(hashCode(submitted), "hex");
  if (expected.length !== actual.length) return "invalide";
  return timingSafeEqual(expected, actual) ? "ok" : "invalide";
}
