import type { EventRow } from "@/db/schema";

/** Default length when the host gave no end time. */
const DEFAULT_DURATION_MS = 2 * 3600_000;

function stampUtc(ts: number): string {
  return new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function stampDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 caps a content line at 75 octets. Fold on octet boundaries, not
 * character ones, or an accented title silently corrupts the file.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never split a multi-byte sequence: back off to the last lead byte.
    while (end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000) end--;
    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return chunks.join("\r\n ");
}

export function eventEnd(event: EventRow): number {
  return event.endsAt ?? event.startsAt + DEFAULT_DURATION_MS;
}

export function buildIcs(event: EventRow, origin: string, host?: string | null): string {
  const url = `${origin}/e/${event.slug}`;
  const description = [event.description, `Répondre : ${url}`]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Event Scheduler//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Stable UID: re-downloading after an edit updates the entry in place
    // instead of creating a duplicate.
    `UID:${event.id}@event-scheduler`,
    `DTSTAMP:${stampUtc(Date.now())}`,
    `SEQUENCE:${Math.floor(event.startsAt / 1000)}`,
    event.allDay
      ? `DTSTART;VALUE=DATE:${stampDate(event.startsAt)}`
      : `DTSTART:${stampUtc(event.startsAt)}`,
    event.allDay
      ? `DTEND;VALUE=DATE:${stampDate(eventEnd(event) + 24 * 3600_000)}`
      : `DTEND:${stampUtc(eventEnd(event))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${url}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(host ? [`ORGANIZER;CN=${escapeText(host)}:MAILTO:noreply@invalid`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function googleCalendarUrl(event: EventRow, origin: string): string {
  const url = `${origin}/e/${event.slug}`;
  const dates = event.allDay
    ? `${stampDate(event.startsAt)}/${stampDate(eventEnd(event) + 24 * 3600_000)}`
    : `${stampUtc(event.startsAt)}/${stampUtc(eventEnd(event))}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    details: [event.description, `Répondre : ${url}`].filter(Boolean).join("\n\n"),
  });
  if (event.location) params.set("location", event.location);

  return `https://calendar.google.com/calendar/render?${params}`;
}

export function icsFilename(event: EventRow): string {
  const base = event.slug.replace(/[^a-z0-9-]/gi, "") || "evenement";
  return `${base}.ics`;
}
