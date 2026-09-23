import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, LoadProblem, NoAccess, Notice, PageHeader, Stat, StatGrid } from "@/components/ui";
import { areas, can } from "@/lib/access";
import { resolvePeopleNames } from "@/lib/data/people";
import { addDays, formatDate, todayIso } from "@/lib/format";
import { committeeDashboard, daysUntil, HORIZON_DAYS } from "@/lib/logic/eams";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { ActionRow } from "./action-row";

export const metadata: Metadata = { title: "Committee dashboard" };

export default async function CommitteeDashboard() {
  const v = await requireViewer();
  if (!areas.committee(v.access)) return <NoAccess area="the Pathshala committee" />;
  if (!can(v.access, "events.view", "events.manage")) {
    return (
      <Notice>
        The dashboard tracks event actions, which your role can&apos;t see. Use{" "}
        <Link className="font-semibold underline" href="/pathshala/committee/concerns">Concerns</Link> or{" "}
        <Link className="font-semibold underline" href="/pathshala/committee/resolutions">Resolutions</Link>.
      </Notice>
    );
  }
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const today = todayIso(tz);

  const res = await load(async () => {
    const [actions, events] = await Promise.all([
      supabase
        .from("actions")
        .select("id, name, state, due_on, owner_person_id, phase, priority, event_id, action_type")
        .eq("center_id", v.center.id)
        .eq("is_idea", false)
        .not("state", "in", "(completed,removed)"),
      supabase
        .from("events")
        .select("id, name, starts_at, owner_person_id, program_year, status")
        .eq("center_id", v.center.id)
        .not("starts_at", "is", null)
        .gte("starts_at", `${addDays(today, -2)}T00:00:00Z`)
        .lte("starts_at", `${addDays(today, HORIZON_DAYS + 2)}T00:00:00Z`),
    ]);
    const a = rows(actions, "committee actions");
    const e = rows(events, "upcoming events");
    const eventIds = [...new Set(a.map((x) => x.event_id).filter((x): x is string => Boolean(x)))].filter((id) => !e.some((ev) => ev.id === id));
    const moreEvents = eventIds.length ? rows(await supabase.from("events").select("id, name").in("id", eventIds), "event names") : [];
    const names = await resolvePeopleNames(supabase, [...a.map((x) => x.owner_person_id), ...e.map((x) => x.owner_person_id)]);
    return { actions: a, events: e, eventNames: new Map([...e, ...moreEvents].map((x) => [x.id, x.name])), names };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { actions, events, eventNames, names } = res.data;
  const dash = committeeDashboard(
    actions,
    events.map((e) => ({ ...e, starts_on: e.starts_at ? todayIso(tz, new Date(e.starts_at)) : null })),
    today,
  );
  const row = (a: (typeof actions)[number]) => (
    <ActionRow key={a.id} a={a} today={today} ownerName={a.owner_person_id ? (names.get(a.owner_person_id) ?? "Someone") : null} eventName={a.event_id ? (eventNames.get(a.event_id) ?? "Event") : null} />
  );

  return (
    <>
      <PageHeader
        title="Next two weeks"
        accent="pathshala"
        description="Overdue, due within 3 days and unassigned actions, plus events in the next 14 days."
        actions={
          can(v.access, "events.manage") && (
            <Link href="/pathshala/committee/actions#new" className="btn btn-purple">
              New action
            </Link>
          )
        }
      />
      <StatGrid>
        <Stat label="Overdue" value={dash.overdue.length} tone="danger" />
        <Stat label="Due ≤ 3 days" value={dash.dueSoon.length} tone="warning" />
        <Stat label="Unassigned" value={dash.unassigned.length} sub="in the next 2 weeks" tone="maroon" />
        <Stat label="Events ≤ 2 weeks" value={dash.eventsSoon.length} tone="purple" />
      </StatGrid>
      {dash.allClear ? (
        <EmptyState title="All clear">Nothing at risk in the next two weeks.</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {dash.unassigned.length > 0 && (
              <Card title="Unassigned — needs an owner">
                <ul className="divide-y divide-line">{dash.unassigned.map(row)}</ul>
              </Card>
            )}
            {dash.overdue.length > 0 && (
              <Card title="Overdue — needs attention now">
                <ul className="divide-y divide-line">{dash.overdue.map(row)}</ul>
              </Card>
            )}
            {dash.dueSoon.length > 0 && (
              <Card title="Due within 3 days">
                <ul className="divide-y divide-line">{dash.dueSoon.map(row)}</ul>
              </Card>
            )}
          </div>
          <div className="space-y-6">
            <Card title="Upcoming events">
              {dash.eventsSoon.length === 0 ? (
                <p className="text-sm text-muted">No events in the next two weeks.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {dash.eventsSoon.map((e) => {
                    const d = daysUntil(e.starts_on, today);
                    return (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div>
                          <Link href={`/events/${e.id}?tab=checklist`} className="font-semibold text-navy hover:underline">
                            {e.name}
                          </Link>
                          <p className="text-xs text-muted">
                            {formatDate(e.starts_on)}
                            {e.program_year ? ` · ${e.program_year}` : ""} · owner {e.owner_person_id ? (names.get(e.owner_person_id) ?? "someone") : "not set"}
                          </p>
                        </div>
                        <span className="text-sm font-semibold">{d === 0 ? "Today" : d === -1 ? "Yesterday" : `In ${d} days`}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            {dash.upcoming.length > 0 && (
              <Card title={`Other actions due within ${HORIZON_DAYS} days`}>
                <ul className="divide-y divide-line">{dash.upcoming.map(row)}</ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
