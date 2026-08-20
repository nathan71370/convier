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

    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        photo TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        last_seen_at INTEGER
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS login_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        ip TEXT,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    await client.execute(
      `CREATE INDEX IF NOT EXISTS login_codes_email_idx ON login_codes (email)`,
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS login_codes_created_idx ON login_codes (created_at)`,
    );
    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        expires_at INTEGER NOT NULL
      )
    `);
    await client.execute(
      `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`,
    );
    await client.execute(`
      CREATE TABLE IF NOT EXISTS rsvps (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        plus_ones INTEGER NOT NULL DEFAULT 0,
        message TEXT,
        host_edited_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        UNIQUE (event_id, user_id)
      )
    `);
    await client.execute(
      `CREATE INDEX IF NOT EXISTS rsvps_event_idx ON rsvps (event_id)`,
    );
    await client.execute(
      `CREATE INDEX IF NOT EXISTS rsvps_user_idx ON rsvps (user_id)`,
    );

    // The production database predates these columns, and SQLite has no
    // ADD COLUMN IF NOT EXISTS. Adding an existing column is the expected
    // outcome on every restart but the first, so it is not an error.
    for (const [table, column, type] of [
      ["events", "host_user_id", "TEXT"],
      ["events", "immich_album_id", "TEXT"],
      ["events", "immich_share_url", "TEXT"],
      ["guests", "email", "TEXT"],
      ["guests", "migrated_at", "INTEGER"],
      ["rsvps", "host_edited_at", "INTEGER"],
    ] as const) {
      try {
        await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (!/duplicate column name/i.test(message)) throw cause;
      }
    }

    // Accounts replaced the secret admin link, but a database created before
    // them still carries `admin_token NOT NULL UNIQUE`. SQLite can neither drop
    // a column backed by a unique index nor relax NOT NULL, so the table is
    // rebuilt — the standard dance, and the only way to retire the column.
    const columns = await client.execute(`PRAGMA table_info(events)`);
    const names = new Set(columns.rows.map((row) => String(row.name)));
    if (names.has("admin_token") || names.has("host_name")) {
      await client.execute(`PRAGMA foreign_keys=OFF`);
      await client.execute(`
        CREATE TABLE events_rebuilt (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          host_user_id TEXT REFERENCES users(id),
          immich_album_id TEXT,
          immich_share_url TEXT,
          title TEXT NOT NULL,
          description TEXT,
          location TEXT,
          starts_at INTEGER NOT NULL,
          ends_at INTEGER,
          all_day INTEGER NOT NULL DEFAULT 0,
          timezone TEXT NOT NULL,
          rsvp_deadline INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        )
      `);
      await client.execute(`
        INSERT INTO events_rebuilt
          (id, slug, host_user_id, immich_album_id, immich_share_url, title,
           description, location, starts_at, ends_at, all_day, timezone,
           rsvp_deadline, created_at)
        SELECT id, slug, host_user_id, immich_album_id, immich_share_url, title,
               description, location, starts_at, ends_at, all_day, timezone,
               rsvp_deadline, created_at
        FROM events
      `);
      await client.execute(`DROP TABLE events`);
      await client.execute(`ALTER TABLE events_rebuilt RENAME TO events`);
      await client.execute(`PRAGMA foreign_keys=ON`);
      console.info("[migration] table events reconstruite sans admin_token");
    }

    // Idempotent: promotes any legacy guest row that has since been given an
    // address, so filling emails in the database and restarting is enough.
    const { promoteLegacyGuests } = await import("@/lib/migrate");
    await promoteLegacyGuests();
  })();
  return schemaReady;
}
