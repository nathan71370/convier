import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { guests, rsvps, users } from "@/db/schema";
import { newId } from "./ids";
import { type LegacyGuest, planPromotion } from "./migrate-plan";

/**
 * Runs the plan. Idempotent by design: `migrated_at` is what stops a restart
 * from resurrecting an answer somebody has since withdrawn.
 */
export async function promoteLegacyGuests(): Promise<void> {
  const rows = (await db
    .select()
    .from(guests)
    .where(isNull(guests.migratedAt))) as unknown as LegacyGuest[];

  if (rows.length === 0) return;

  const plan = planPromotion(rows);
  const now = Date.now();
  const idByEmail = new Map<string, string>();

  for (const profile of plan.users) {
    await db
      .insert(users)
      .values({ id: newId(), email: profile.email, name: profile.name, photo: profile.photo })
      .onConflictDoNothing({ target: users.email });

    const [row] = await db
      .select({ id: users.id, name: users.name, photo: users.photo })
      .from(users)
      .where(eq(users.email, profile.email))
      .limit(1);
    if (!row) continue;
    idByEmail.set(profile.email, row.id);

    // Only fill gaps: an account that already has a name chose it deliberately.
    const fill: { name?: string; photo?: string } = {};
    if (!row.name && profile.name) fill.name = profile.name;
    if (!row.photo && profile.photo) fill.photo = profile.photo;
    if (Object.keys(fill).length > 0) {
      await db.update(users).set(fill).where(eq(users.id, row.id));
    }
  }

  let promoted = 0;
  for (const answer of plan.rsvps) {
    const userId = idByEmail.get(answer.email);
    if (!userId) continue;

    await db
      .insert(rsvps)
      .values({
        id: newId(),
        eventId: answer.eventId,
        userId,
        status: answer.status,
        plusOnes: answer.plusOnes,
        message: answer.message,
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
      })
      .onConflictDoNothing();
    promoted += 1;
  }

  // Every row that had an address is now accounted for, including the losers
  // of a duplicate pair, so none is reconsidered on the next start.
  await db
    .update(guests)
    .set({ migratedAt: now })
    .where(and(isNull(guests.migratedAt), sql`${guests.email} IS NOT NULL`));

  if (promoted > 0 || plan.skipped.length > 0) {
    console.info(
      `[migration] ${promoted} reponse(s) promue(s), ${plan.skipped.length} sans adresse laissee(s) dans guests` +
        (plan.skipped.length ? ` : ${plan.skipped.join(", ")}` : ""),
    );
  }
}
