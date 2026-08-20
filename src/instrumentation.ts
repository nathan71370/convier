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

  try {
    await ready();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    // Refusing to serve a half-migrated database is deliberate. Saying why is
    // what turns a five-minute fix into a five-minute fix: the usual cause is
    // a database file restored as root while the container runs as `node`.
    if (/readonly|SQLITE_CANTOPEN|permission/i.test(message)) {
      console.error(
        "[db] La base est inaccessible en écriture. Si tu viens de restaurer " +
          "une sauvegarde dans le volume, corrige son propriétaire :\n" +
          "  docker run --rm -v <volume>:/data alpine chown -R 1000:1000 /data",
      );
    }
    throw cause;
  }
}
