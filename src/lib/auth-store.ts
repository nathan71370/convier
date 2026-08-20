import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, ready } from "@/db";
import { loginCodes, sessions, type UserRow, users } from "@/db/schema";
import { newAdminToken, newId } from "./ids";
import { CODE_TTL_MS, hashCode } from "./otp";
import { type Counts, WINDOWS_MS } from "./ratelimit";

export const SESSION_TTL_MS = 90 * 24 * 3600_000;

export async function countRecentCodes(email: string, ip: string | null): Promise<Counts> {
  await ready();
  const now = Date.now();

  const count = async (where: Parameters<typeof db.select>[0] extends never ? never : ReturnType<typeof and>) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(loginCodes)
      .where(where);
    return Number(row?.n ?? 0);
  };

  return {
    perEmail: await count(
      and(eq(loginCodes.email, email), gt(loginCodes.createdAt, now - WINDOWS_MS.perEmail)),
    ),
    perIp: ip
      ? await count(and(eq(loginCodes.ip, ip), gt(loginCodes.createdAt, now - WINDOWS_MS.perIp)))
      : 0,
    global: await count(and(gt(loginCodes.createdAt, now - WINDOWS_MS.global))),
  };
}

export async function createLoginCode(
  email: string,
  code: string,
  ip: string | null,
): Promise<void> {
  await ready();
  const now = Date.now();
  // Any code still outstanding for this address is retired, so the newest mail
  // is always the one that works.
  await db
    .update(loginCodes)
    .set({ consumedAt: now })
    .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt)));

  await db.insert(loginCodes).values({
    id: newId(),
    email,
    codeHash: hashCode(code),
    ip,
    expiresAt: now + CODE_TTL_MS,
    createdAt: now,
  });
}

export async function findLatestCode(email: string) {
  await ready();
  const [row] = await db
    .select()
    .from(loginCodes)
    .where(eq(loginCodes.email, email))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  return row ?? null;
}

export async function bumpAttempts(id: string): Promise<void> {
  await db
    .update(loginCodes)
    .set({ attempts: sql`${loginCodes.attempts} + 1` })
    .where(eq(loginCodes.id, id));
}

export async function consumeCode(id: string): Promise<void> {
  await db.update(loginCodes).set({ consumedAt: Date.now() }).where(eq(loginCodes.id, id));
}

export async function findOrCreateUser(email: string): Promise<UserRow> {
  await ready();
  await db
    .insert(users)
    .values({ id: newId(), email })
    .onConflictDoNothing({ target: users.email });

  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!row) throw new Error("Compte introuvable après création.");
  return row;
}

export async function startSessionRow(userId: string): Promise<string> {
  await ready();
  // The id is the secret the cookie carries, so it comes from the same source
  // as the old admin tokens rather than being derived from anything.
  const id = newAdminToken();
  await db.insert(sessions).values({ id, userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

export async function findSessionUser(sessionId: string): Promise<UserRow | null> {
  await ready();
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, Date.now())))
    .limit(1);
  return row?.user ?? null;
}

export async function extendSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ expiresAt: Date.now() + SESSION_TTL_MS })
    .where(eq(sessions.id, sessionId));
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function touchUser(userId: string): Promise<void> {
  await db.update(users).set({ lastSeenAt: Date.now() }).where(eq(users.id, userId));
}

export async function updateProfile(
  userId: string,
  fields: { name?: string | null; photo?: string | null },
): Promise<void> {
  await ready();
  await db.update(users).set(fields).where(eq(users.id, userId));
}

/** Fills a blank profile from what someone just typed into an RSVP form. */
export async function fillProfileGaps(
  user: UserRow,
  name: string,
  photo: string | null,
): Promise<void> {
  const fields: { name?: string; photo?: string } = {};
  if (!user.name && name) fields.name = name;
  if (!user.photo && photo) fields.photo = photo;
  if (Object.keys(fields).length > 0) await updateProfile(user.id, fields);
}
