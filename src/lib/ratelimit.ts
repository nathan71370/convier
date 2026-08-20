/**
 * Opening login to any address turns the code request into a publicly
 * reachable email sender. Without these caps, anyone who finds the URL can
 * have codes blasted at arbitrary inboxes using the host's SMTP credentials
 * and domain reputation.
 */
export const CAPS = { perEmail: 3, perIp: 10, global: 100 } as const;

export const WINDOWS_MS = {
  perEmail: 15 * 60_000,
  perIp: 60 * 60_000,
  global: 60 * 60_000,
} as const;

export type Counts = { perEmail: number; perIp: number; global: number };

export const exceedsCaps = (counts: Counts): boolean =>
  counts.perEmail >= CAPS.perEmail ||
  counts.perIp >= CAPS.perIp ||
  counts.global >= CAPS.global;
