import { cookies } from "next/headers";
import { newGuestKey } from "./ids";

const COOKIE = "guest_key";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * A random per-browser identifier. It is what lets a guest come back and
 * change their answer without ever creating an account — and nothing more:
 * it grants no access to anything but that guest's own row.
 */
export async function readGuestKey(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/** Callable only from a Server Action or Route Handler. */
export async function ensureGuestKey(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;

  const key = newGuestKey();
  store.set(COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return key;
}
