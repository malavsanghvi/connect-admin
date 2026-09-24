import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PersonPicker } from "@/components/person-picker";
import { Badge, Card, Checkbox, Details, EmptyState, Field, FormGrid, LoadProblem, NoAccess, PageHeader, Select, Tabs } from "@/components/ui";
import { areas, can } from "@/lib/access";
import { resolveUserNames } from "@/lib/data/people";
import { formatDateTime, humanize } from "@/lib/format";
import type { StatusUpdate } from "@/lib/logic/eams";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { createActionFromConcern, createConcern, updateConcern } from "../actions";

export const metadata: Metadata = { title: "Concerns" };

export default async function ConcernsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.pathshalaAdmin(v.access)) return <NoAccess area="Pathshala concerns" />;
  const sp = await searchParams;
  const view = sp.view === "closed" ? "closed" : sp.view === "all" ? "all" : "open";
  const source = sp.source === "teacher" || sp.source === "parent" ? sp.source : null;
  const openId = typeof sp.open === "string" ? sp.open : null;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const manage = can(v.access, "pathshala.manage");
  const canAct = can(v.access, "events.manage");

  const res = await load(async () => {
    let q = supabase.from("concerns").select("*").eq("center_id", v.center.id).order("created_at", { ascending: false }).limit(200);
    if (view === "open") q = q.neq("status", "closed");
    if (view === "closed") q = q.eq("status", "closed");
    if (source) q = q.eq("source", source);
    const concerns = rows(await q, "concerns");
    const actionIds = concerns.map((c) => c.linked_action_id).filter((x): x is string => Boolean(x));
    const [classes, actions, owners] = await Promise.all([
      supabase.from("pathshala_classes").select("id, name, term_id").eq("center_id", v.center.id).order("name"),
      actionIds.length ? supabase.from("actions").select("id, name, state").in("id", actionIds) : Promise.resolve({ data: [], error: null }),
      resolveUserNames(supabase, v.center.id, concerns.map((c) => c.owner_user_id)),
    ]);
    if (actions.error) console.error("[concerns] linked actions unavailable", actions.error);
    return { concerns, classes: rows(classes, "classes"), actions: actions.data ?? [], owners };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { concerns, classes, actions, owners } = res.data;
  const href = (k: string) => `/pathshala/committee/concerns?view=${k}${source ? `&source=${source}` : ""}`;

  return (
    <>
      <PageHeader title="Concerns" accent="pathshala" description="Raised by teachers and parents, tracked until resolved. Turn one into an action to put it on the committee dashboard." />
      <Tabs
        active={view}
        tabs={[
          { key: "open", label: "Open", href: href("open") },
          { key: "closed", label: "Closed", href: href("closed") },
          { key: "all", label: "All", href: href("all") },
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[null, "teacher", "parent"].map((s) => (
          <Link
            key={s ?? "any"}
            href={`/pathshala/committee/concerns?view=${view}${s ? `&source=${s}` : ""}`}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 font-semibold ${source === s ? "border-navy bg-navy text-white" : "border-line bg-white text-navy"}`}
          >
            {s ? `From ${s}s` : "Everyone"}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {concerns.length === 0 ? (
            <EmptyState title="No concerns here" />
          ) : (
            <ul className="space-y-3">
              {concerns.map((c) => {
                const updates = Array.isArray(c.status_updates) ? (c.status_updates as StatusUpdate[]) : [];
                const action = actions.find((a) => a.id === c.linked_action_id);
                const canEdit = manage || c.owner_user_id === v.userId;
                return (
                  <li key={c.id}>
                    <Card>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={c.status === "closed" ? "success" : c.status === "in_progress" ? "navy" : "warning"}>{humanize(c.status)}</Badge>
                        <Badge tone="purple">{humanize(c.source)}</Badge>
                        {c.class_id && <Badge tone="muted">{classes.find((x) => x.id === c.class_id)?.name ?? "Class"}</Badge>}
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold">{c.title}</h3>
                      <p className="mt-1 whitespace-pre-line text-sm">{c.description}</p>
                      {c.suggestions && <p className="mt-1 text-sm text-muted">Suggestion: {c.suggestions}</p>}
                      <p className="mt-2 text-xs text-muted">
                        {c.submitter_name ?? "Anonymous"}
                        {c.submitter_email ? ` · ${c.submitter_email}` : ""}
                        {c.submitter_phone ? ` · ${c.submitter_phone}` : ""} · {formatDateTime(c.created_at, tz)} · owner:{" "}
                        {c.owner_user_id ? (c.owner_user_id === v.userId ? "you" : (owners.get(c.owner_user_id) ?? "assigned")) : "none"}
                      </p>
                      {action && (
                        <p className="mt-2 text-sm">
                          Action:{" "}
                          <Link className="font-semibold text-navy underline" href={`/pathshala/committee/actions/${action.id}`}>
                            {action.name}
                          </Link>{" "}
                          <Badge tone="muted">{humanize(action.state)}</Badge>
                        </p>
                      )}
                      {c.resolution && <p className="mt-2 rounded-lg bg-success-soft p-2 text-sm text-success">Resolution: {c.resolution}</p>}
                      {updates.length > 0 && (
                        <ol className="mt-2 space-y-1 border-l-2 border-line pl-3 text-xs text-muted">
                          {updates.map((u, i) => (
                            <li key={i}>
                              {formatDateTime(u.date, tz)} · {u.author}: {u.text}
                            </li>
                          ))}
                        </ol>
                      )}
                      {canEdit && (
                        <div className="mt-3 space-y-2">
                          <Details summary="Update" open={openId === c.id}>
                            <ActionForm action={updateConcern.bind(null, c.id)} submitLabel="Save">
                              <FormGrid>
                                <Field label="Status">
                                  <Select
                                    name="status"
                                    defaultValue={c.status}
                                    options={[
                                      { value: "reported", label: "Reported" },
                                      { value: "in_progress", label: "In progress" },
                                      { value: "closed", label: "Closed" },
                                    ]}
                                  />
                                </Field>
                                <Field label="Owner">
                                  <Select
                                    name="owner"
                                    defaultValue=""
                                    placeholder="Keep as is"
                                    options={[
                                      { value: "me", label: "Assign to me" },
                                      { value: "none", label: "Unassign" },
                                    ]}
                                  />
                                </Field>
                                <Field label="Progress note" className="sm:col-span-2">
                                  <input name="note" className="field-input" />
                                </Field>
                                <Field label="Resolution (required to close)" className="sm:col-span-2">
                                  <textarea name="resolution" rows={2} defaultValue={c.resolution ?? ""} className="field-input" />
                                </Field>
                              </FormGrid>
                            </ActionForm>
                          </Details>
                          {canAct && !c.linked_action_id && (
                            <Details summary="⚡ Create action">
                              <ActionForm action={createActionFromConcern.bind(null, c.id)} submitLabel="Create action" submitClassName="btn btn-purple">
                                <FormGrid>
                                  <Field label="Action" className="sm:col-span-2">
                                    <input name="name" defaultValue={`Concern: ${c.title}`} className="field-input" />
                                  </Field>
                                  <PersonPicker name="owner_person_id" label="Owner" />
                                  <Field label="Due date">
                                    <input type="date" name="due_on" className="field-input" />
                                  </Field>
                                  <Field label="Priority">
                                    <Select
                                      name="priority"
                                      defaultValue="high"
                                      options={["low", "medium", "high", "critical"].map((p) => ({ value: p, label: humanize(p) }))}
                                    />
                                  </Field>
                                </FormGrid>
                              </ActionForm>
                            </Details>
                          )}
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="lg:col-span-2">
          {manage ? (
            <Card title="Log a concern" description="For concerns received by phone, email or in person.">
              <ActionForm action={createConcern} submitLabel="Log concern" resetOnSuccess submitClassName="btn btn-purple">
                <div className="space-y-3">
                  <Field label="From">
                    <Select
                      name="source"
                      defaultValue="parent"
                      options={[
                        { value: "parent", label: "Parent" },
                        { value: "teacher", label: "Teacher" },
                        { value: "member", label: "Member" },
                        { value: "other", label: "Other" },
                      ]}
                    />
                  </Field>
                  <Field label="Name">
                    <input name="submitter_name" className="field-input" />
                  </Field>
                  <FormGrid>
                    <Field label="Email">
                      <input type="email" name="submitter_email" className="field-input" />
                    </Field>
                    <Field label="Phone">
                      <input type="tel" name="submitter_phone" className="field-input" />
                    </Field>
                  </FormGrid>
                  <Field label="Class (optional)">
                    <Select name="class_id" placeholder="Not about one class" options={classes.map((c) => ({ value: c.id, label: c.name }))} />
                  </Field>
                  <Field label="Title">
                    <input name="title" required className="field-input" />
                  </Field>
                  <Field label="What happened">
                    <textarea name="description" required rows={4} className="field-input" />
                  </Field>
                  <Field label="Their suggestion">
                    <textarea name="suggestions" rows={2} className="field-input" />
                  </Field>
                  <Checkbox name="assign_me" label="Assign to me" defaultChecked />
                </div>
              </ActionForm>
            </Card>
          ) : (
            <p className="text-sm text-muted">Only the Pathshala principal can log or update concerns.</p>
          )}
        </div>
      </div>
    </>
  );
}
