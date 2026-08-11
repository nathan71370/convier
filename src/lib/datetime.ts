/**
 * Every timestamp is stored as an absolute instant. The event carries its own
 * IANA zone so that a guest in Tokyo still reads the hour the host intended,
 * labelled with the city it belongs to.
 */

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let found = cache.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat("fr-FR", { ...options, timeZone });
    cache.set(key, found);
  }
  return found;
}

export function formatDay(ts: number, timeZone: string): string {
  return formatter(timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(ts);
}

export function formatTime(ts: number, timeZone: string): string {
  return formatter(timeZone, { hour: "2-digit", minute: "2-digit" }).format(ts);
}

export function formatRange(
  startsAt: number,
  endsAt: number | null,
  allDay: boolean,
  timeZone: string,
): string {
  const day = formatDay(startsAt, timeZone);
  if (allDay) {
    if (!endsAt || sameDay(startsAt, endsAt, timeZone)) return day;
    return `${day} — ${formatDay(endsAt, timeZone)}`;
  }
  const start = `${day} à ${formatTime(startsAt, timeZone)}`;
  if (!endsAt) return start;
  if (sameDay(startsAt, endsAt, timeZone)) {
    return `${start} – ${formatTime(endsAt, timeZone)}`;
  }
  return `${start} → ${formatDay(endsAt, timeZone)} à ${formatTime(endsAt, timeZone)}`;
}

function sameDay(a: number, b: number, timeZone: string): boolean {
  const fmt = formatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(a) === fmt.format(b);
}

/** "Paris", "New York" — the last segment of an IANA zone, made readable. */
export function zoneLabel(timeZone: string): string {
  const city = timeZone.split("/").pop() ?? timeZone;
  return city.replace(/_/g, " ");
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600_000],
  ["month", 30 * 24 * 3600_000],
  ["day", 24 * 3600_000],
  ["hour", 3600_000],
  ["minute", 60_000],
];

export function countdown(target: number, now: number): string {
  const diff = target - now;
  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 60_000), "minute");
}
