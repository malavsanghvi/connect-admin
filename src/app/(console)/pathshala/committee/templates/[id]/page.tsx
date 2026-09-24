import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm } from "@/components/action-form";
import { PersonPicker } from "@/components/person-picker";
import { Badge, Card, Checkbox, Details, EmptyState, Field, FormGrid, LoadProblem, NoAccess, PageHeader, Select } from "@/components/ui";
import { can } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { resolvePeopleNames } from "@/lib/data/people";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import type { Lesson } from "@/lib/logic/eams";
import { getSupabase, load, requireViewer, row, rows } from "@/lib/session";
import { PHASE_LABEL } from "../../action-row";
import { addLesson, deleteTemplateItem, pushLessonsToTemplate, removeLesson, saveTemplate, saveTemplateItem } from "../../actions";

export const metadata: Metadata = { title: "Template" };

function ItemFields({ item, phase }: { item: Tables<"event_template_items"> | null; phase: string }) {
  return (
    <FormGrid>
      <input type="hidden" name="phase" value={item?.phase ?? phase} />
      <Field label="Item" className="sm:col-span-2">
        <input name="name" required defaultValue={item?.name ?? ""} className="field-input" />
      </Field>
      <Field label="Priority">
        <Select
          name="priority"
          defaultValue={item?.priority ?? "medium"}
          options={["low", "medium", "high", "critical"].map((p) => ({ value: p, label: humanize(p) }))}
        />
      </Field>
      <Field label="Type">
        <Select
          name="action_type"
          defaultValue={item?.action_type ?? "task"}
          options={["task", "meeting", "email", "call", "whatsapp_announcement"].map((p) => ({ value: p, label: humanize(p) }))}
        />
      </Field>
      {(item?.phase ?? phase) !== "during" && (
        <Field label="Days from the event" hint="Negative = before (e.g. -14), positive = after">
          <input name="offset_days" type="number" defaultValue={item?.offset_days ?? ""} className="field-input" />
        </Field>
      )}
      <Field label="Order">
        <input name="sort_order" type="number" defaultValue={item?.sort_order ?? 0} className="field-input" />
      </Field>
      <Field label="Details" className="sm:col-span-2">
        <textarea name="description" rows={2} defaultValue={item?.description ?? ""} className="field-input" />
      </Field>
      <Checkbox name="confidential" label="Confidential" defaultChecked={item?.confidential ?? false} />
    </FormGrid>
  );
}

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer();
  if (!can(v.access, "events.view", "events.manage")) return <NoAccess area="event templates" />;
  const manage = can(v.access, "events.manage");
  const supabase = await getSupabase();
  const tz = v.center.time_zone;

  const res = await load(async () => {
    const template = row(await supabase.from("event_templates").select("*").eq("id", id).maybeSingle(), "the template");
    if (!template) return null;
    const [items, events] = await Promise.all([
      supabase.from("event_template_items").select("*").eq("template_id", id).order("sort_order"),
      supabase.from("events").select("id, name, starts_at, program_year, lessons_learned").eq("template_id", id).order("starts_at", { ascending: false, nullsFirst: true }),
    ]);
    const names = await resolvePeopleNames(supabase, [template.default_owner_person_id]);
    return { template, items: rows(items, "checklist items"), events: rows(events, "events"), names };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { template, items, events, names } = res.data;
  const lessons = Array.isArray(template.lessons_learned) ? (template.lessons_learned as Lesson[]) : [];
  const target = { table: "event_templates" as const, id: template.id };

  return (
    <>
      <PageHeader
        title={template.name}
        accent="pathshala"
        back={{ href: "/pathshala/committee/templates", label: "Templates" }}
        description={template.description ?? undefined}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(["pre", "during", "after"] as const).map((phase) => {
            const list = items.filter((i) => i.phase === phase);
            return (
              <Card key={phase} title={`${PHASE_LABEL[phase]} the event`} description={phase === "during" ? "Due on the event day automatically." : undefined}>
                {list.length === 0 ? (
                  <p className="text-sm text-muted">No items.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {list.map((it) => (
                      <li key={it.id} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{it.name}</p>
                            <p className="text-xs text-muted">
                              {humanize(it.priority)} · {humanize(it.action_type)}
                              {it.offset_days !== null ? ` · ${it.offset_days < 0 ? `${-it.offset_days} days before` : `${it.offset_days} days after`}` : ""}
                              {it.confidential ? " · confidential" : ""}
                            </p>
                          </div>
                          {manage && (
                            <ActionButton action={deleteTemplateItem.bind(null, it.id)} label="Remove" className="btn btn-danger" confirm={`Remove "${it.name}" from the template?`} />
                          )}
                        </div>
                        {manage && (
                          <div className="mt-2">
                            <Details summary="Edit item">
                              <ActionForm action={saveTemplateItem.bind(null, template.id, it.id)} submitLabel="Save item">
                                <ItemFields item={it} phase={phase} />
                              </ActionForm>
                            </Details>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {manage && (
                  <div className="mt-3">
                    <Details summary={`Add a ${PHASE_LABEL[phase].toLowerCase()} item`}>
                      <ActionForm action={saveTemplateItem.bind(null, template.id, null)} submitLabel="Add item" resetOnSuccess submitClassName="btn btn-purple">
                        <ItemFields item={null} phase={phase} />
                      </ActionForm>
                    </Details>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        <div className="space-y-6">
          <Card title="Lessons learned">
            {lessons.length === 0 ? (
              <p className="text-sm text-muted">None yet. Add what went well or badly so next year goes smoother.</p>
            ) : (
              <ul className="space-y-2">
                {lessons.map((l) => (
                  <li key={l.id} className="rounded-lg bg-sand p-3 text-sm">
                    <p className="whitespace-pre-line">{l.text}</p>
                    <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span>
                        {l.author} · {formatDateTime(l.created_at, tz)}
                      </span>
                      {manage && <ActionButton action={removeLesson.bind(null, target, l.id)} label="Remove" className="btn btn-danger min-h-9 px-2 py-1" confirm="Remove this lesson?" />}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {manage && (
              <div className="mt-3">
                <ActionForm action={addLesson.bind(null, target)} submitLabel="Add lesson" resetOnSuccess>
                  <textarea name="text" rows={2} required className="field-input" aria-label="Lesson learned" />
                </ActionForm>
              </div>
            )}
          </Card>
          <Card title="Events made from this template">
            {events.length === 0 ? (
              <EmptyState title="None yet" />
            ) : (
              <ul className="divide-y divide-line">
                {events.map((e) => {
                  const n = Array.isArray(e.lessons_learned) ? e.lessons_learned.length : 0;
                  return (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <Link href={`/events/${e.id}?tab=checklist`} className="font-semibold text-navy hover:underline">
                          {e.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {e.starts_at ? formatDate(e.starts_at, tz) : "No date"}
                          {e.program_year ? ` · ${e.program_year}` : ""}
                          {n ? ` · ${n} lesson${n === 1 ? "" : "s"}` : ""}
                        </p>
                      </div>
                      {manage && n > 0 && <ActionButton action={pushLessonsToTemplate.bind(null, e.id)} label="Pull lessons" />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          {manage && (
            <Card title="Template settings">
              <ActionForm action={saveTemplate.bind(null, template.id)} submitLabel="Save template">
                <div className="space-y-3">
                  <Field label="Name">
                    <input name="name" required defaultValue={template.name} className="field-input" />
                  </Field>
                  <Field label="Description">
                    <textarea name="description" rows={3} defaultValue={template.description ?? ""} className="field-input" />
                  </Field>
                  <PersonPicker
                    name="default_owner_person_id"
                    label="Default event owner"
                    initial={template.default_owner_person_id ? [{ id: template.default_owner_person_id, name: names.get(template.default_owner_person_id) ?? "Someone", detail: null }] : []}
                  />
                  <Checkbox name="confidential" label="Confidential" defaultChecked={template.confidential} />
                </div>
              </ActionForm>
              {template.confidential && (
                <p className="mt-2">
                  <Badge tone="warning">Confidential</Badge>
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
