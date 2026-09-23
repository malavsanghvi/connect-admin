import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LoadProblem, NoAccess, PageHeader, TableWrap, Tabs, td, th, type Tone } from "@/components/ui";
import { areas, can } from "@/lib/access";
import { formatDateTime, fromDateTimeLocal, humanize, todayIso } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";

export const metadata: Metadata = { title: "Events" };

const STATUS_TONE: Record<string, Tone> = {
  draft: "muted",
  published: "navy",
  rsvp_closed: "warning",
  live: "success",
  completed: "neutral",
  cancelled: "danger",
};

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.events(v.access)) return <NoAccess area="events" />;
  const sp = await searchParams;
  const view = sp.view === "past" ? "past" : sp.view === "undated" ? "undated" : "upcoming";
  const status = typeof sp.status === "string" ? sp.status : null;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;

  const res = await load(async () => {
    const nowIso = fromDateTimeLocal(`${todayIso(tz)}T00:00`, tz)!;
    let q = supabase.from("events").select("id, name, starts_at, venue, status, audience, capacity, program_year, confidential").eq("center_id", v.center.id);
    if (view === "upcoming") q = q.gte("starts_at", nowIso).order("starts_at");
    if (view === "past") q = q.lt("starts_at", nowIso).order("starts_at", { ascending: false }).limit(100);
    if (view === "undated") q = q.is("starts_at", null).order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const events = rows(await q, "events");
    const counts = events.length
      ? rows(await supabase.from("rsvps").select("event_id, status").in("event_id", events.map((e) => e.id)), "RSVP counts")
      : [];
    return { events, counts };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { events, counts } = res.data;
  const href = (k: string) => `/events?view=${k}${status ? `&status=${status}` : ""}`;

  return (
    <>
      <PageHeader
        kicker="Events"
        accent="events"
        title="Events"
        description="RSVPs, checklists, volunteers, lunch slots and the day-of report."
        actions={
          can(v.access, "events.manage") && (
            <Link href="/events/new" className="btn btn-maroon">
              New event
            </Link>
          )
        }
      />
      <Tabs
        active={view}
        tabs={[
          { key: "upcoming", label: "Upcoming", href: href("upcoming") },
          { key: "past", label: "Past", href: href("past") },
          { key: "undated", label: "No date yet", href: href("undated") },
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {[null, "draft", "published", "rsvp_closed", "live", "completed", "cancelled"].map((s) => (
          <Link
            key={s ?? "all"}
            href={`/events?view=${view}${s ? `&status=${s}` : ""}`}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${status === s ? "border-maroon bg-maroon text-white" : "border-line bg-white text-maroon"}`}
          >
            {s ? humanize(s) : "Any status"}
          </Link>
        ))}
      </div>
      <Card>
        {events.length === 0 ? (
          <EmptyState title="No events here" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={th}>Event</th>
                  <th className={th}>When</th>
                  <th className={th}>Audience</th>
                  <th className={th}>RSVPs</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const mine = counts.filter((c) => c.event_id === e.id);
                  const active = mine.filter((c) => c.status !== "cancelled").length;
                  const confirmed = mine.filter((c) => c.status === "confirmed" || c.status === "attended").length;
                  return (
                    <tr key={e.id}>
                      <td className={td}>
                        <Link href={`/events/${e.id}`} className="font-semibold text-navy hover:underline">
                          {e.name}
                        </Link>
                        <div className="text-xs text-muted">
                          {e.venue ?? ""}
                          {e.program_year ? ` · Pathshala ${e.program_year}` : ""}
                          {e.confidential ? " · confidential" : ""}
                        </div>
                      </td>
                      <td className={td}>{e.starts_at ? formatDateTime(e.starts_at, tz) : "—"}</td>
                      <td className={td}>{humanize(e.audience)}</td>
                      <td className={td}>
                        {active} households{e.capacity ? ` · cap ${e.capacity}` : ""}
                        <div className="text-xs text-muted">{confirmed} confirmed</div>
                      </td>
                      <td className={td}>
                        <Badge tone={STATUS_TONE[e.status] ?? "neutral"}>{humanize(e.status)}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
