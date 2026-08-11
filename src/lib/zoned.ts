/**
 * Conversion between wall-clock strings (what a `datetime-local` input speaks)
 * and absolute instants (what the database stores), in an explicit IANA zone.
 *
 * Doing this on the server rather than in the browser keeps two things honest:
 * the host who edits a Paris event from Tokyo still sees Paris hours, and the
 * rendered markup does not depend on where the renderer happens to run.
 */

const parts = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let found = parts.get(timeZone);
  if (!found) {
    found = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    parts.set(timeZone, found);
  }
  return found;
}

type Fields = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function fields(ts: number, timeZone: string): Fields {
  const map: Record<string, number> = {};
  for (const part of formatter(timeZone).formatToParts(ts)) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    // Midnight comes back as hour 24 in some ICU versions.
    hour: map.hour % 24,
    minute: map.minute,
    second: map.second,
  };
}

/** Milliseconds the zone is ahead of UTC at the given instant. */
export function zoneOffset(ts: number, timeZone: string): number {
  const f = fields(ts, timeZone);
  return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second) - ts;
}

/**
 * "2026-09-12T19:30" in Europe/Paris → the matching epoch. The offset is
 * resolved twice because the first guess can land on the wrong side of a
 * daylight-saving change.
 */
export function zonedToEpoch(local: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local.trim());
  if (!match) return null;

  const [, y, m, d, hh = "0", mm = "0"] = match;
  const naive = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
  if (Number.isNaN(naive)) return null;

  const first = naive - zoneOffset(naive, timeZone);
  const second = naive - zoneOffset(first, timeZone);
  return second;
}

/** The inverse: an instant rendered as the value a date input expects. */
export function epochToLocalInput(
  ts: number,
  timeZone: string,
  allDay: boolean,
): string {
  const f = fields(ts, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${f.year}-${pad(f.month)}-${pad(f.day)}`;
  return allDay ? day : `${day}T${pad(f.hour)}:${pad(f.minute)}`;
}

/** A friendly starting point for a new event: a week out, early evening. */
export function defaultStartLocal(now: number, timeZone: string): string {
  const f = fields(now + 7 * 24 * 3600_000, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${f.year}-${pad(f.month)}-${pad(f.day)}T19:30`;
}
