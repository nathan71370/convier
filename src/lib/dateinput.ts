/**
 * Display formatting for the date fields.
 *
 * A native `datetime-local` renders its text in the browser's own locale, and
 * nothing — not `lang`, not CSS, not an attribute — changes that. A French
 * visitor on a US-configured browser reads 08/23/2026 and misreads the day as
 * the month. So the visible field is a plain text input we format ourselves,
 * in `jj/mm/aaaa`, while the value the form posts stays the canonical
 * `YYYY-MM-DD[THH:mm]` the server expects.
 */

export const DATE_PLACEHOLDER = "jj/mm/aaaa";
export const DATETIME_PLACEHOLDER = "jj/mm/aaaa hh:mm";

const CANONICAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** `2026-08-23T02:00` → `23/08/2026 02:00`. Empty in, empty out. */
export function toDisplay(canonical: string, withTime: boolean): string {
  const match = CANONICAL.exec(canonical.trim());
  if (!match) return "";
  const [, year, month, day, hour, minute] = match;
  const date = `${day}/${month}/${year}`;
  if (!withTime) return date;
  return `${date} ${hour ?? "00"}:${minute ?? "00"}`;
}

/**
 * Keeps the separators in step with the digits as the visitor types, so they
 * only ever enter numbers. Anything that is not a digit is dropped, which also
 * makes backspacing over a slash behave the way people expect.
 */
export function maskDisplay(raw: string, withTime: boolean): string {
  const digits = raw.replace(/\D/g, "").slice(0, withTime ? 12 : 8);
  const parts: string[] = [];

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const hour = digits.slice(8, 10);
  const minute = digits.slice(10, 12);

  if (day) parts.push(day);
  if (month) parts.push(month);
  if (year) parts.push(year);

  let out = parts.join("/");
  // Trailing separator once a group is full, so the caret moves on by itself.
  if (digits.length === 2 || digits.length === 4) out += "/";

  if (withTime && hour) {
    out += ` ${hour}`;
    if (minute) out += `:${minute}`;
    else if (digits.length === 10) out += ":";
  }

  return out;
}

/**
 * `23/08/2026 02:00` → `2026-08-23T02:00`, or null while the value is still
 * incomplete or plainly impossible (31/02, 25:00…).
 */
export function fromDisplay(text: string, withTime: boolean): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length !== (withTime ? 12 : 8)) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (!isRealDate(year, month, day)) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${year}-${pad(month)}-${pad(day)}`;
  if (!withTime) return date;

  const hour = Number(digits.slice(8, 10));
  const minute = Number(digits.slice(10, 12));
  if (hour > 23 || minute > 59) return null;

  return `${date}T${pad(hour)}:${pad(minute)}`;
}

/** True once the visitor has typed something that cannot become a date. */
export function isIncorrect(text: string, withTime: boolean): boolean {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 0) return false;
  if (digits.length < (withTime ? 12 : 8)) return false;
  return fromDisplay(text, withTime) === null;
}
