import type { EventRow } from "@/db/schema";
import { googleCalendarUrl } from "@/lib/ics";

export function CalendarActions({
  event,
  origin,
}: {
  event: EventRow;
  origin: string;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      <a
        href={`/api/e/${event.slug}/ics`}
        className="btn-quiet"
        download
        data-testid="ics-download"
      >
        <span aria-hidden>↓</span> Apple / Outlook
      </a>
      <a
        href={googleCalendarUrl(event, origin)}
        target="_blank"
        rel="noreferrer noopener"
        className="btn-quiet"
      >
        Google Agenda ↗
      </a>
    </div>
  );
}
