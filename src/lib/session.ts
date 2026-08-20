import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRow } from "@/db/schema";
import {
  deleteSession,
  extendSession,
  findSessionUser,
  SESSION_TTL_MS,
  startSessionRow,
  touchUser,
} from "./auth-store";

const COOKIE = "session";

export async function currentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE)?.value;
  if (!sessionId) return null;

  const user = await findSessionUser(sessionId);
  if (!user) return null;
  return user;
}

/**
 * Redirects to the login page, remembering where the visitor was headed so the
 * code they type lands them on the invitation rather than the home page.
 */
export async function requireUser(next?: string): Promise<UserRow> {
  const user = await currentUser();
  if (user) return user;
  const target = next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "";
  redirect(`/connexion${target}`);
}

/** Callable only from a Server Action or Route Handler. */
export async function startSession(userId: string): Promise<void> {
  const id = await startSessionRow(userId);
  const store = await cookies();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  await touchUser(userId);
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE)?.value;
  if (sessionId) await deleteSession(sessionId);
  store.delete(COOKIE);
}

/** Kept out of `currentUser` so pages stay read-only; called from actions. */
export async function refreshSession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE)?.value;
  if (!sessionId) return;
  await extendSession(sessionId);
  store.set(COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}
