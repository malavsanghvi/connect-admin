import type { Metadata } from "next";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, Details, EmptyState, Field, LoadProblem, NoAccess, PageHeader } from "@/components/ui";
import { areas, can, hasCenterRole, hasScopedRole, teacherClassIds } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { loadTerms, pickTerm } from "@/lib/data/pathshala";
import { resolveUserNames } from "@/lib/data/people";
import { formatDateTime } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { deleteAnnouncement, saveAnnouncement, setAnnouncementPublished } from "../actions";
import { TermSwitcher } from "../term-switcher";

export const metadata: Metadata = { title: "Class announcements" };

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.announcements(v.access)) return <NoAccess area="Pathshala announcements" />;
  const sp = await searchParams;
  const supabase = await getSupabase();
  const manage = can(v.access, "pathshala.manage");

  const res = await load(async () => {
    const terms = await loadTerms(supabase, v.center.id);
    const term = pickTerm(terms, typeof sp.term === "string" ? sp.term : null);
    if (!term) return { terms, term: null, classes: [], items: [], authors: new Map<string, string>() };
    let classes = rows(await supabase.from("pathshala_classes").select("id, name").eq("term_id", term.id).order("name"), "classes");
    if (!areas.pathshalaAdmin(v.access) && !hasCenterRole(v.access, "teacher")) {
      const mine = new Set(teacherClassIds(v.access));
      classes = classes.filter((c) => mine.has(c.id));
    }
    const ids = classes.map((c) => c.id);
    const filter = ids.length ? `term_id.eq.${term.id},class_id.in.(${ids.join(",")})` : `term_id.eq.${term.id}`;
    const items = rows(
      await supabase.from("class_announcements").select("*").eq("center_id", v.center.id).or(filter).order("created_at", { ascending: false }).limit(100),
      "announcements",
    );
    const authors = await resolveUserNames(supabase, v.center.id, items.map((i) => i.author_user));
    return { terms, term, classes, items, authors };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { terms, term, classes, items, authors } = res.data;
  const preselect = typeof sp.class === "string" && classes.some((c) => c.id === sp.class) ? sp.class : manage ? "term" : (classes[0]?.id ?? "");
  const audienceOptions = [...(manage ? [{ value: "term", label: "Whole Pathshala (all families this term)" }] : []), ...classes.map((c) => ({ value: c.id, label: c.name }))];
  const canEditItem = (a: Tables<"class_announcements">) =>
    manage || (a.class_id !== null && hasScopedRole(v.access, a.class_id, "teacher") && a.author_user === v.userId);

  return (
    <>
      <PageHeader
        kicker="Pathshala"
        accent="pathshala"
        title="Announcements"
        description="Messages to Pathshala families, by class or for the whole term. Families see them in the Connect app once published."
      />
      <TermSwitcher terms={terms} activeId={term?.id ?? null} basePath="/pathshala/announcements" />
      {!term ? (
        <EmptyState title="No Pathshala term yet" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {items.length === 0 ? (
              <EmptyState title="No announcements yet" />
            ) : (
              <ul className="space-y-3">
                {items.map((a) => {
                  const audience = a.class_id ? (classes.find((c) => c.id === a.class_id)?.name ?? "A class") : "Whole Pathshala";
                  return (
                    <li key={a.id}>
                      <Card>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={a.published_at ? "success" : "muted"}>{a.published_at ? "Published" : "Draft"}</Badge>
                          <Badge tone="purple">{audience}</Badge>
                        </div>
                        <h3 className="mt-2 font-display text-lg font-semibold">{a.title}</h3>
                        <p className="mt-1 whitespace-pre-line text-sm">{a.body_md}</p>
                        <p className="mt-2 text-xs text-muted">
                          {a.published_at ? `Published ${formatDateTime(a.published_at, v.center.time_zone)}` : `Created ${formatDateTime(a.created_at, v.center.time_zone)}`}
                          {a.author_user ? ` · by ${a.author_user === v.userId ? "you" : (authors.get(a.author_user) ?? "staff")}` : ""}
                        </p>
                        {canEditItem(a) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <ActionButton
                              action={setAnnouncementPublished.bind(null, a.id)}
                              fields={{ publish: a.published_at ? "0" : "1" }}
                              label={a.published_at ? "Unpublish" : "Publish"}
                              className={a.published_at ? "btn btn-secondary" : "btn btn-purple"}
                              confirm={a.published_at ? undefined : `Publish "${a.title}" to ${audience} families?`}
                            />
                            <ActionButton action={deleteAnnouncement.bind(null, a.id)} label="Delete" className="btn btn-danger" confirm="Delete this announcement?" />
                          </div>
                        )}
                        {canEditItem(a) && (
                          <div className="mt-3">
                            <Details summary="Edit">
                              <ActionForm action={saveAnnouncement.bind(null, a.id)} submitLabel="Save">
                                <input type="hidden" name="term_id" value={a.term_id ?? term.id} />
                                <input type="hidden" name="scope" value={a.class_id ?? "term"} />
                                <Field label="Title">
                                  <input name="title" required defaultValue={a.title} className="field-input" />
                                </Field>
                                <Field label="Message" className="mt-3">
                                  <textarea name="body_md" required rows={5} defaultValue={a.body_md} className="field-input" />
                                </Field>
                              </ActionForm>
                            </Details>
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
            <Card title="New announcement">
              {audienceOptions.length === 0 ? (
                <p className="text-sm text-muted">You don&apos;t teach a class this term.</p>
              ) : (
                <ActionForm
                  action={saveAnnouncement.bind(null, null)}
                  submitLabel="Save draft"
                  submitClassName="btn btn-secondary"
                  resetOnSuccess
                  successMessage={null}
                  extraButtons={
                    <button type="submit" name="intent" value="publish" className="btn btn-purple">
                      Publish now
                    </button>
                  }
                >
                  <input type="hidden" name="term_id" value={term.id} />
                  <div className="space-y-3">
                    <Field label="Send to">
                      <select name="scope" required defaultValue={preselect} className="field-input">
                        {audienceOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Title">
                      <input name="title" required className="field-input" />
                    </Field>
                    <Field label="Message" hint="Plain text; line breaks are kept. Parents only — never one-to-one messages to students.">
                      <textarea name="body_md" required rows={6} className="field-input" />
                    </Field>
                  </div>
                </ActionForm>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
