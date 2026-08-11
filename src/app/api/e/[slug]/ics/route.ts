import { getEventBySlug } from "@/lib/events";
import { buildIcs, icsFilename } from "@/lib/ics";
import { getOrigin } from "@/lib/origin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return new Response("Événement introuvable", { status: 404 });

  const origin = await getOrigin();

  return new Response(buildIcs(event, origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(event)}"`,
      "Cache-Control": "no-store",
    },
  });
}
