import { getEventBySlug, hostName } from "@/lib/events";
import { currentUser } from "@/lib/session";
import { buildIcs, icsFilename } from "@/lib/ics";
import { getOrigin } from "@/lib/origin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // A download, not a navigation: answer 401 rather than redirecting into a
  // login page the calendar client could not use anyway.
  if (!(await currentUser())) return new Response("Connexion requise", { status: 401 });

  const event = await getEventBySlug(slug);
  if (!event) return new Response("Événement introuvable", { status: 404 });

  const [origin, host] = await Promise.all([getOrigin(), hostName(event)]);

  return new Response(buildIcs(event, origin, host), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(event)}"`,
      "Cache-Control": "no-store",
    },
  });
}
