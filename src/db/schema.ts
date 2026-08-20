import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  /** Always stored lowercased: it is the identity key. */
  email: text("email").notNull().unique(),
  name: text("name"),
  photo: text("photo"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastSeenAt: integer("last_seen_at"),
});

export const loginCodes = sqliteTable(
  "login_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    /** SHA-256 of the code peppered with AUTH_SECRET. Never the code itself. */
    codeHash: text("code_hash").notNull(),
    ip: text("ip"),
    expiresAt: integer("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: integer("consumed_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("login_codes_email_idx").on(table.email),
    index("login_codes_created_idx").on(table.createdAt),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    /** The id is the secret the cookie carries, so it is never derived. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  hostUserId: text("host_user_id").references(() => users.id),
  immichAlbumId: text("immich_album_id"),
  immichShareUrl: text("immich_share_url"),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startsAt: integer("starts_at").notNull(),
  endsAt: integer("ends_at"),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  timezone: text("timezone").notNull(),
  rsvpDeadline: integer("rsvp_deadline"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const guests = sqliteTable(
  "guests",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    guestKey: text("guest_key").notNull(),
    name: text("name").notNull(),
    photo: text("photo"),
    status: text("status", { enum: ["yes", "no", "maybe"] }).notNull(),
    plusOnes: integer("plus_ones").notNull().default(0),
    message: text("message"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    email: text("email"),
    migratedAt: integer("migrated_at"),
  },
  (table) => [
    unique("guests_event_guest_key").on(table.eventId, table.guestKey),
    index("guests_event_idx").on(table.eventId),
  ],
);

export const rsvps = sqliteTable(
  "rsvps",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["yes", "no", "maybe"] }).notNull(),
    plusOnes: integer("plus_ones").notNull().default(0),
    message: text("message"),
    /** Set when the host answered on someone's behalf; cleared the moment that
     * person edits their own answer again. */
    hostEditedAt: integer("host_edited_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    unique("rsvps_event_user").on(table.eventId, table.userId),
    index("rsvps_event_idx").on(table.eventId),
    index("rsvps_user_idx").on(table.userId),
  ],
);

export type EventRow = typeof events.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type RsvpRow = typeof rsvps.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type LoginCodeRow = typeof loginCodes.$inferSelect;
export type RsvpStatus = RsvpRow["status"];

/** Legacy cookie-identified answers. Kept as an archive; never read by the app
 * after the promotion pass in lib/migrate.ts. */
export type GuestRow = typeof guests.$inferSelect;
