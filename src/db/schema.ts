import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  adminToken: text("admin_token").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startsAt: integer("starts_at").notNull(),
  endsAt: integer("ends_at"),
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  timezone: text("timezone").notNull(),
  hostName: text("host_name"),
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
  },
  (table) => [
    unique("guests_event_guest_key").on(table.eventId, table.guestKey),
    index("guests_event_idx").on(table.eventId),
  ],
);

export type EventRow = typeof events.$inferSelect;
export type GuestRow = typeof guests.$inferSelect;
export type RsvpStatus = GuestRow["status"];
