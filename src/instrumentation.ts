/**
 * Runs once when the server boots.
 *
 * The schema used to be created lazily, on the first query. That was enough
 * while every page hit the database, but the login page does not: on a fresh
 * deployment nothing would touch it until someone asked for a code, so the
 * columns the operator needs to fill in before restarting would not exist yet.
 * Booting the schema explicitly makes the deploy sequence predictable.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ready } = await import("@/db");
  await ready();
}
