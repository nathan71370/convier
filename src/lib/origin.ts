import { headers } from "next/headers";

/**
 * Absolute origin of the current request — needed for share links and ICS.
 *
 * `SITE_URL` is deliberately not a `NEXT_PUBLIC_` variable: those are inlined
 * at build time, which would tie one built image to one domain. This is read
 * on the server at request time, so the same image serves any host.
 */
export async function getOrigin(): Promise<string> {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/+$/, "");
  }
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost:3000";
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
