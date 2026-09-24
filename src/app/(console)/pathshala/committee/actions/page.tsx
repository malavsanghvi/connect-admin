import type { Metadata } from "next";
import { Card, EmptyState, LoadProblem, NoAccess, PageHeader, Tabs } from "@/components/ui";
import { can } from "@/lib/access";
import { resolvePeopleNames } from "@/lib/data/people";
import { todayIso } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { ActionEditor } from "../action-form";
import { ActionRow } from "../action-row";

export const metadata: Metadata = { title: "Committee actions" };

const VIEWS = ["open", "mine", "ideas", "done", "all"] as const;

export default async function ActionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!can(v.access, "events.view", "events.manage") && !v.personId) return <NoAccess area="committee actions" />;
  const sp = await searchParams;
  const view = (VIEWS as readonly string[]).includes(String(sp.view)) ? String(sp.view) : "open";
  const eventFilter = typeof sp.event === "string" ? sp.event : null;
  const supabase = await getSupabase();
  const today = todayIso(v.center.time_zone);

  const res = await load(async () => {
    let q = supabase
      .from("actions")
      .select("id, name, state, due_on, owner_person_id, phase, priority, event_id, action_type, is_idea")
      .eq("center_id", v.center.id)
      .order("due_on", { ascending: true, nullsFirst: false })
      .limit(300);
    if (view === "open") q = q.not("state", "in", "(completed,removed)").eq("is_idea", false);
    if (view === "mine" && v.personId) q = q.not("state", "in", "(completed,removed)").or(`owner_person_id.eq.${v.personId},backup_owner_ids.cs.{${v.personId}}`);
    if (view === "ideas") q = q.eq("is_idea", true);
    if (view === "done") q = q.eq("state", "completed");
    if (eventFilter) q = q.eq("event_id", eventFilter);
    const [actions, events] = await Promise.all([
      q,
      supabase.from("events").select("id, name, starts_at").eq("center_id", v.center.id).order("starts_at", { ascending: false, nullsFirst: true }).limit(200),
    ]);
    const a = rows(actions, "actions");
    return { actions: a, events: rows(events, "events"), names: await resolvePeopleNames(supabase, a.map((x) => x.owner_person_id)) };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { actions, events, names } = res.data;
  const eventName = new Map(events.map((e) => [e.id, e.name]));
  const qs = (k: string) => `/pathshala/committee/actions?view=${k}${eventFilter ? `&event=${eventFilter}` : ""}`;

  return (
    <>
      <PageHeader title="Actions" accent="pathshala" description="Every checklist action across events, plus standalone tasks and ideas." />
      <Tabs
        active={view}
        tabs={[
          { key: "open", label: "Open", href: qs("open") },
          ...(v.personId ? [{ key: "mine", label: "Mine", href: qs("mine") }] : []),
          { key: "ideas", label: "Ideas", href: qs("ideas") },
          { key: "done", label: "Completed", href: qs("done") },
          { key: "all", label: "All", href: qs("all") },
        ]}
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="view" value={view} />
        <label className="block min-w-[16rem] flex-1">
          <span className="mb-1 block text-sm font-semibold">Event</span>
          <select name="event" defaultValue={eventFilter ?? ""} className="field-input">
            <option value="">All events and standalone</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
      </form>
      <Card>
        {actions.length === 0 ? (
          <EmptyState title="No actions here" />
        ) : (
          <ul className="divide-y divide-line">
            {actions.map((a) => (
              <ActionRow
                key={a.id}
                a={a}
                today={today}
                ownerName={a.owner_person_id ? (names.get(a.owner_person_id) ?? "Someone") : null}
                eventName={a.event_id ? (eventName.get(a.event_id) ?? "Event") : null}
              />
            ))}
          </ul>
        )}
      </Card>
      {can(v.access, "events.manage") && (
        <Card title="New action" className="mt-6" id="new">
          <ActionEditor action={null} events={events} owner={null} backups={[]} defaultEventId={eventFilter} />
        </Card>
      )}
    </>
  );
}
