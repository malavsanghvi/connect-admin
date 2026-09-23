import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Card, Details, EmptyState, LoadProblem } from "@/components/ui";
import { can, hasScopedRole } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { resolvePeopleNames } from "@/lib/data/people";
import { formatDateTime, todayIso } from "@/lib/format";
import type { Lesson } from "@/lib/logic/eams";
import { getSupabase, load, rows, type Viewer } from "@/lib/session";
import { ActionEditor } from "@/app/(console)/pathshala/committee/action-form";
import { ActionRow, PHASE_LABEL } from "@/app/(console)/pathshala/committee/action-row";
import { addLesson, pushLessonsToTemplate, removeLesson, setActionState } from "@/app/(console)/pathshala/committee/actions";

export async function ChecklistTab({ event, viewer }: { event: Tables<"events">; viewer: Viewer }) {
  const supabase = await getSupabase();
  const tz = viewer.center.time_zone;
  const today = todayIso(tz);
  const res = await load(async () => {
    const [actions, template] = await Promise.all([
      supabase.from("actions").select("*").eq("event_id", event.id).order("due_on", { nullsFirst: false }),
      event.template_id ? supabase.from("event_templates").select("id, name").eq("id", event.template_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    const a = rows(actions, "the checklist");
    if (template.error) console.error("[checklist] template name unavailable", template.error);
    return { actions: a, template: template.data, names: await resolvePeopleNames(supabase, a.map((x) => x.owner_person_id)) };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { actions, template, names } = res.data;
  const canEdit = can(viewer.access, "events.manage") || hasScopedRole(viewer.access, event.id, "event_lead");
  const lessons = Array.isArray(event.lessons_learned) ? (event.lessons_learned as Lesson[]) : [];
  const target = { table: "events" as const, id: event.id };
  const standalone = actions.filter((a) => !a.phase);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {template && (
          <p className="text-sm text-muted">
            Made from the template{" "}
            <Link href={`/pathshala/committee/templates/${template.id}`} className="font-semibold text-navy underline">
              {template.name}
            </Link>
            . Open an action to push changes back to the template.
          </p>
        )}
        {(["pre", "during", "after"] as const).map((phase) => {
          const list = actions.filter((a) => a.phase === phase);
          const done = list.filter((a) => a.state === "completed").length;
          return (
            <Card key={phase} title={`${PHASE_LABEL[phase]} the event`} description={`${done} of ${list.length} done`}>
              {list.length === 0 ? (
                <p className="text-sm text-muted">Nothing in this phase.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {list.map((a) => (
                    <ActionRow
                      key={a.id}
                      a={a}
                      today={today}
                      ownerName={a.owner_person_id ? (names.get(a.owner_person_id) ?? "Someone") : null}
                      eventName={null}
                      extra={
                        a.state !== "completed" && a.state !== "removed" ? (
                          <ActionButton action={setActionState.bind(null, a.id)} fields={{ state: "completed" }} label="✓ Done" className="btn btn-success" />
                        ) : null
                      }
                    />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
        {standalone.length > 0 && (
          <Card title="Other actions for this event">
            <ul className="divide-y divide-line">
              {standalone.map((a) => (
                <ActionRow key={a.id} a={a} today={today} ownerName={a.owner_person_id ? (names.get(a.owner_person_id) ?? "Someone") : null} eventName={null} />
              ))}
            </ul>
          </Card>
        )}
        {actions.length === 0 && <EmptyState title="No checklist yet">Add actions below, or create events from a template to start with a checklist.</EmptyState>}
        {canEdit && (
          <Details summary="Add an action to this event">
            <ActionEditor action={null} events={[{ id: event.id, name: event.name, starts_at: event.starts_at }]} owner={null} backups={[]} defaultEventId={event.id} defaultPhase="pre" />
          </Details>
        )}
      </div>
      <div className="space-y-6">
        <Card title="Lessons learned">
          {lessons.length === 0 ? (
            <p className="text-sm text-muted">Capture what to repeat or change next time.</p>
          ) : (
            <ul className="space-y-2">
              {lessons.map((l) => (
                <li key={l.id} className="rounded-lg bg-sand p-3 text-sm">
                  <p className="whitespace-pre-line">{l.text}</p>
                  <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      {l.author} · {formatDateTime(l.created_at, tz)}
                    </span>
                    {canEdit && <ActionButton action={removeLesson.bind(null, target, l.id)} label="Remove" className="btn btn-danger min-h-9 px-2 py-1" confirm="Remove this lesson?" />}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="mt-3">
              <ActionForm action={addLesson.bind(null, target)} submitLabel="Add lesson" resetOnSuccess>
                <textarea name="text" rows={2} required className="field-input" aria-label="Lesson learned" />
              </ActionForm>
            </div>
          )}
          {template && lessons.length > 0 && can(viewer.access, "events.manage") && (
            <div className="mt-3 border-t border-line pt-3">
              <ActionButton action={pushLessonsToTemplate.bind(null, event.id)} label="Push lessons to the template" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
