import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LoadProblem, NoAccess, PageHeader, TableWrap, td, th } from "@/components/ui";
import { areas, can } from "@/lib/access";
import { formatCents, formatDateTime, humanize } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { BoliForm } from "./boli-form";

export const metadata: Metadata = { title: "Bolis" };

export default async function BolisPage() {
  const v = await requireViewer();
  if (!areas.bolis(v.access)) return <NoAccess area="bolis" />;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const res = await load(async () => {
    const [bolis, events] = await Promise.all([
      supabase.from("bolis").select("*").eq("center_id", v.center.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("events").select("id, name").eq("center_id", v.center.id).order("starts_at", { ascending: false, nullsFirst: true }).limit(100),
    ]);
    const b = rows(bolis, "bolis");
    const entries = b.length ? await supabase.from("boli_entries").select("boli_id, amount_cents").in("boli_id", b.map((x) => x.id)) : { data: [], error: null };
    if (entries.error) console.error("[bolis] pledge totals unavailable", entries.error);
    return { bolis: b, events: rows(events, "events"), entries: entries.data ?? [], entriesError: Boolean(entries.error) };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { bolis, events, entries, entriesError } = res.data;

  return (
    <>
      <PageHeader kicker="Events" accent="events" title="Bolis" description="Digital bolis run in the member app until the cutoff; in-person bolis are recorded in the hall. Both end as pledges." />
      <Card>
        {bolis.length === 0 ? (
          <EmptyState title="No bolis yet" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={th}>Boli</th>
                  <th className={th}>Kind</th>
                  <th className={th}>Closes</th>
                  <th className={th}>Top pledge</th>
                  <th className={th}>Pledges</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bolis.map((b) => {
                  const mine = entries.filter((e) => e.boli_id === b.id);
                  const top = mine.reduce((m, e) => Math.max(m, e.amount_cents), 0);
                  return (
                    <tr key={b.id}>
                      <td className={td}>
                        <Link className="font-semibold text-navy hover:underline" href={`/bolis/${b.id}`}>
                          {b.name}
                        </Link>
                        {b.event_id && <div className="text-xs text-muted">{events.find((e) => e.id === b.event_id)?.name ?? "Event"}</div>}
                      </td>
                      <td className={td}>{b.kind === "digital" ? "Digital" : "In person"}</td>
                      <td className={td}>{formatDateTime(b.extended_until ?? b.closes_at, tz)}</td>
                      <td className={td}>{entriesError ? "—" : top ? formatCents(top) : "None yet"}</td>
                      <td className={td}>{entriesError ? "—" : mine.length}</td>
                      <td className={td}>
                        <Badge tone={b.status === "open" ? "success" : b.status === "closed" || b.status === "settled" ? "neutral" : b.status === "paused" ? "warning" : "muted"}>
                          {humanize(b.status)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {can(v.access, "bolis.manage") && (
        <Card title="New boli" className="mt-6">
          <BoliForm boli={null} events={events} tz={tz} />
        </Card>
      )}
    </>
  );
}
