import { Card, Details, LoadProblem, Stat, StatGrid, TableWrap, td, th } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { formatTime, humanize } from "@/lib/format";
import { eventReport, lunchSlotCounts, UNLIMITED_SEATS } from "@/lib/logic/event-report";
import { getSupabase, load, rows, type Viewer } from "@/lib/session";

export async function ReportTab({ event, viewer }: { event: Tables<"events">; viewer: Viewer }) {
  const supabase = await getSupabase();
  const tz = viewer.center.time_zone;
  const res = await load(async () => {
    const [rsvps, attendees, slots, scans] = await Promise.all([
      supabase.from("rsvps").select("id, status, source, confirmed_at, guest_name").eq("event_id", event.id),
      supabase.from("attendees").select("*").eq("event_id", event.id).order("display_name"),
      supabase.from("lunch_slots").select("id, starts_at, seats, status").eq("event_id", event.id),
      supabase.from("scan_log").select("station, result, offline_queued").eq("event_id", event.id).limit(10000),
    ]);
    return { rsvps: rows(rsvps, "RSVPs"), attendees: rows(attendees, "attendees"), slots: rows(slots, "lunch slots"), scans: rows(scans, "scan log") };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { rsvps, attendees, slots, scans } = res.data;
  const r = eventReport(rsvps, attendees);
  const lunch = lunchSlotCounts(slots, attendees);
  const scanBy = new Map<string, number>();
  for (const s of scans) scanBy.set(`${s.station}|${s.result}`, (scanBy.get(`${s.station}|${s.result}`) ?? 0) + 1);
  const offline = scans.filter((s) => s.offline_queued).length;
  const noShowNames = attendees.filter((a) => {
    const rv = rsvps.find((x) => x.id === a.rsvp_id);
    return rv && rv.status !== "cancelled" && rv.source !== "walk_in" && a.status !== "cancelled" && !a.checked_in_at;
  });

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat label="RSVP'd" value={r.rsvpdPeople} sub={`${r.householdsTotal} households`} tone="maroon" />
        <Stat label="Confirmed" value={r.confirmedPeople} tone="navy" />
        <Stat label="Checked in" value={r.checkedIn} sub={`${r.walkIns} walk-ins (${r.walkInHouseholds} parties)`} tone="success" />
        <Stat label="Served lunch" value={r.served} sub={`${r.giftsGiven} gifts given`} tone="warning" />
      </StatGrid>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Funnel">
          <TableWrap>
            <table className="w-full">
              <tbody>
                {[
                  ["RSVP'd (people, excl. walk-ins)", r.rsvpdPeople],
                  ["Confirmed", r.confirmedPeople],
                  ["Checked in (incl. walk-ins)", r.checkedIn],
                  ["Walk-ins", r.walkIns],
                  ["No-shows (RSVP'd, not checked in)", r.noShows],
                  ["Served food", r.served],
                  ["Children under 12 · seniors · assistance", `${r.flags.childUnder12} · ${r.flags.senior} · ${r.flags.assistance}`],
                ].map(([k, val]) => (
                  <tr key={String(k)}>
                    <td className={td}>{k}</td>
                    <td className={`${td} text-right font-semibold`}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card title="Scans" description={offline ? `${offline} were recorded offline and synced later.` : undefined}>
          {scans.length === 0 ? (
            <p className="text-sm text-muted">No scans yet.</p>
          ) : (
            <TableWrap>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Station</th>
                    <th className={th}>Result</th>
                    <th className={th}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {[...scanBy.entries()]
                    .sort()
                    .map(([k, n]) => {
                      const [station, result] = k.split("|");
                      return (
                        <tr key={k}>
                          <td className={td}>{humanize(station)}</td>
                          <td className={td}>{humanize(result)}</td>
                          <td className={td}>{n}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>
      {lunch.length > 0 && (
        <Card title="Lunch by slot">
          <TableWrap>
            <table className="w-full min-w-[480px]">
              <thead>
                <tr>
                  <th className={th}>Slot</th>
                  <th className={th}>Seats</th>
                  <th className={th}>Assigned</th>
                  <th className={th}>Served</th>
                </tr>
              </thead>
              <tbody>
                {lunch.map((s) => (
                  <tr key={s.id}>
                    <td className={td}>{formatTime(s.starts_at, tz)}</td>
                    <td className={td}>{s.seats >= UNLIMITED_SEATS ? "∞" : s.seats}</td>
                    <td className={td}>{s.assignedCount}</td>
                    <td className={td}>{s.servedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
      {noShowNames.length > 0 && (
        <Details summary={`Not checked in (${noShowNames.length})`}>
          <ul className="columns-1 gap-6 text-sm sm:columns-2">
            {noShowNames.map((a) => (
              <li key={a.id}>{a.display_name}</li>
            ))}
          </ul>
        </Details>
      )}
    </div>
  );
}
