import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/local.db";

if (url.startsWith("file:")) {
  const dir = path.dirname(path.resolve(url.slice("file:".length)));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

/**
 * The whole schema fits in two tables, so it is cheaper to create them on
 * demand than to carry a migration toolchain. Memoised: the statements run
 * once per process, and every query path awaits the same promise.
 */
let schemaReady: Promise<void> | undefined;

export function ready(): Promise<void> {
  schemaReady ??= (async () => {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        admin_token TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        starts_at INTEGER NOT NULL,
        ends_at INTEGER,
        all_day INTEGER NOT NULL DEFAULT 0,
        timezone TEXT NOT NULL,
        host_name TEXT,
        rsvp_deadline INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS guests (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        guest_key TEXT NOT NULL,
        name TEXT NOT NULL,
        photo TEXT,
        status TEXT NOT NULL,
        plus_ones INTEGER NOT NULL DEFAULT 0,
        message TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        UNIQUE (event_id, guest_key)
      )
    `);
    await client.execute(
      `CREATE INDEX IF NOT EXISTS guests_event_idx ON guests (event_id)`,
    );
  })();
  return schemaReady;
}
