import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { PersonPicker } from "@/components/person-picker";
import { Badge, Card, Checkbox, Details, EmptyState, Field, LoadProblem, NoAccess, Notice, PageHeader, Stat, StatGrid, TableWrap, td, th } from "@/components/ui";
import { areas, can, hasScopedRole } from "@/lib/access";
import { formatCents, formatDateTime, humanize } from "@/lib/format";
import { getSupabase, load, requireViewer, row, rows } from "@/lib/session";
import { closeBoli, recordInPersonPledge, setBoliStatus } from "../actions";
import { BoliForm } from "../boli-form";

export const metadata: Metadata = { title: "Boli" };

export default async function BoliPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer();
  if (!areas.bolis(v.access)) return <NoAccess area="bolis" />;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;

  const res = await load(async () => {
    const boli = row(await supabase.from("bolis").select("*").eq("id", id).maybeSingle(), "the boli");
    if (!boli) return null;
    const [summary, entries, events] = await Promise.all([
      supabase.rpc("boli_summary", { p_boli: id }),
      supabase.from("boli_entries").select("*").eq("boli_id", id).order("amount_cents", { ascending: false }).order("entered_at"),
      supabase.from("events").select("id, name").eq("center_id", v.center.id).order("starts_at", { ascending: false, nullsFirst: true }).limit(100),
    ]);
    if (summary.error) console.error("[boli] boli_summary unavailable", summary.error);
    if (entries.error) console.error("[boli] pledges unavailable", entries.error);
    const e = entries.data ?? [];
    const hh = e.length ? await supabase.from("households").select("id, display_name").in("id", [...new Set(e.map((x) => x.household_id))]) : { data: [], error: null };
    if (hh.error) console.error("[boli] household names unavailable", hh.error);
    return {
      boli,
      summary: summary.data?.[0] ?? null,
      entries: e,
      entriesHidden: Boolean(entries.error),
      households: hh.data ?? [],
      events: rows(events, "events"),
    };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { boli, summary, entries, entriesHidden, households, events } = res.data;
  const manage = can(v.access, "bolis.manage");
  const canRecord = boli.kind === "in_person" && (can(v.access, "bolis.manage", "bolis.record") || (boli.event_id !== null && hasScopedRole(v.access, boli.event_id, "boli_recorder")));
  const top = summary?.top_cents ?? entries[0]?.amount_cents ?? null;
  const count = summary?.entries ?? entries.length;
  const minimum = summary?.minimum_cents ?? (top ? top + boli.step_cents : boli.floor_cents);
  const closes = summary?.closes_at ?? boli.extended_until ?? boli.closes_at;
  const winner = entries.find((e) => e.id === boli.winner_entry_id);
  const name = (e: (typeof entries)[number]) =>
    e.anonymous ? "Anonymous" : (e.display_name ?? households.find((h) => h.id === e.household_id)?.display_name ?? "A family");

  return (
    <>
      <PageHeader
        kicker={`Boli · ${boli.kind === "digital" ? "Digital" : "In person"}`}
        accent="events"
        title={boli.name}
        back={{ href: "/bolis", label: "Bolis" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={boli.status === "open" ? "success" : boli.status === "paused" ? "warning" : "muted"}>{humanize(boli.status)}</Badge>
            {boli.event_id && <span>{events.find((e) => e.id === boli.event_id)?.name}</span>}
          </span>
        }
      />
      {boli.status === "open" && <AutoRefresh seconds={15} timeZone={tz} />}
      <StatGrid>
        <Stat label="Top pledge" value={top ? formatCents(top) : "None yet"} tone="maroon" />
        <Stat label="Pledges" value={count} tone="navy" />
        <Stat label="Next pledge at least" value={formatCents(minimum)} sub={`step ${formatCents(boli.step_cents)}`} tone="warning" />
        <Stat label="Closes" value={closes ? formatDateTime(closes, tz) : "—"} sub={boli.extended_until ? "extended by a late pledge" : undefined} tone="purple" />
      </StatGrid>
      {winner && (
        <div className="mb-6">
          <Notice tone="success">
            Closed. Top pledge {formatCents(winner.amount_cents)} by {name(winner)} — recorded as a pledge for the family.
          </Notice>
        </div>
      )}
      {manage && (
        <div className="mb-6 flex flex-wrap gap-2">
          {boli.status === "draft" && (
            <ActionButton action={setBoliStatus.bind(null, boli.id)} fields={{ status: "open" }} label="Publish" className="btn btn-maroon" confirm="Publish this boli? Members can pledge once it opens." />
          )}
          {boli.status === "open" && <ActionButton action={setBoliStatus.bind(null, boli.id)} fields={{ status: "paused" }} label="Pause" />}
          {boli.status === "paused" && <ActionButton action={setBoliStatus.bind(null, boli.id)} fields={{ status: "open" }} label="Resume" className="btn btn-maroon" />}
          {(boli.status === "open" || boli.status === "paused") && (
            <ActionButton
              action={closeBoli.bind(null, boli.id)}
              label="Close and record the top pledge"
              className="btn btn-danger"
              confirm="Close this boli now? The highest pledge (earliest wins a tie) becomes the family's pledge."
            />
          )}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Pledges" className="lg:col-span-2">
          {entriesHidden ? (
            <p className="text-sm text-muted">Your role can see the top pledge but not individual pledges.</p>
          ) : entries.length === 0 ? (
            <EmptyState title="No pledges yet" />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th className={th}>Family</th>
                    <th className={th}>Pledge</th>
                    <th className={th}>When</th>
                    <th className={th}>How</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className={e.id === boli.winner_entry_id ? "bg-success-soft" : undefined}>
                      <td className={td}>{name(e)}</td>
                      <td className={`${td} font-semibold`}>{formatCents(e.amount_cents)}</td>
                      <td className={td}>{formatDateTime(e.entered_at, tz)}</td>
                      <td className={td}>{e.is_in_person ? "In person" : "App"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
        <div className="space-y-6">
          {canRecord && boli.status !== "closed" && boli.status !== "settled" && (
            <Card title="Record in-person pledge">
              <ActionForm action={recordInPersonPledge.bind(null, boli.id)} submitLabel="Record pledge" resetOnSuccess submitClassName="btn btn-maroon">
                <div className="space-y-3">
                  <PersonPicker
                    name="household_id"
                    label="Family"
                    endpoint="/api/households"
                    placeholder="Search family name or number"
                    required
                    hint="Every pledge belongs to a family record."
                  />
                  <Field label="Pledge amount ($)" hint={`At least ${formatCents(minimum)}`}>
                    <input name="amount" inputMode="decimal" required className="field-input text-lg" />
                  </Field>
                  <Field label="Name to display (optional)">
                    <input name="display_name" className="field-input" />
                  </Field>
                  <Checkbox name="anonymous" label="Family asked to stay anonymous" />
                </div>
              </ActionForm>
            </Card>
          )}
          {manage && (
            <Details summary="Edit boli">
              <BoliForm boli={boli} events={events} tz={tz} />
            </Details>
          )}
        </div>
      </div>
    </>
  );
}
