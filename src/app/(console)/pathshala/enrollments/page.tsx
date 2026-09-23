import type { Metadata } from "next";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, Details, EmptyState, LoadProblem, NoAccess, PageHeader, Tabs } from "@/components/ui";
import { areas } from "@/lib/access";
import { ageFrom, loadClasses, loadLevels, loadTerms, pickTerm } from "@/lib/data/pathshala";
import { formatDate, todayIso } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { placeEnrollment, saveEnrollmentNote, setEnrollmentStatus, waitlistEnrollment } from "../actions";
import { TermSwitcher } from "../term-switcher";

export const metadata: Metadata = { title: "Enrollments" };

const STATUSES = ["requested", "waitlisted", "placed", "active", "withdrawn", "completed"] as const;

export default async function EnrollmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.pathshalaAdmin(v.access)) return <NoAccess area="Pathshala enrollments" />;
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(String(sp.status)) ? String(sp.status) : "requested";
  const supabase = await getSupabase();
  const canManage = areas.pathshalaManage(v.access);
  const today = todayIso(v.center.time_zone);

  const res = await load(async () => {
    const [terms, levels] = await Promise.all([loadTerms(supabase, v.center.id), loadLevels(supabase, v.center.id)]);
    const term = pickTerm(terms, typeof sp.term === "string" ? sp.term : null);
    if (!term) return { terms, levels, term: null, all: [], classes: [], people: [], households: [] };
    const [all, classes] = await Promise.all([
      supabase.from("pathshala_enrollments").select("*").eq("term_id", term.id).order("registered_at"),
      loadClasses(supabase, v.center.id, term.id),
    ]);
    const enr = rows(all, "enrollments");
    const shown = enr.filter((e) => e.status === status);
    const [people, households] = await Promise.all([
      shown.length
        ? supabase.from("people").select("id, first_name, last_name, preferred_name, date_of_birth").in("id", shown.map((e) => e.student_person_id))
        : Promise.resolve({ data: [], error: null }),
      shown.length
        ? supabase.from("households").select("id, display_name").in("id", shown.map((e) => e.household_id))
        : Promise.resolve({ data: [], error: null }),
    ]);
    // Household names need people.view; without it they are simply not shown.
    if (households.error) console.error("[enrollments] household names unavailable", households.error);
    return { terms, levels, term, all: enr, classes, people: rows(people, "student names"), households: households.data ?? [] };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { terms, levels, term, all, classes, people, households } = res.data;

  const counts = Object.fromEntries(STATUSES.map((s) => [s, all.filter((e) => e.status === s).length]));
  const seats = new Map(classes.map((c) => [c.id, all.filter((e) => e.class_id === c.id && (e.status === "placed" || e.status === "active")).length]));
  const shown = all.filter((e) => e.status === status);
  const levelName = (id: string | null) => levels.find((l) => l.id === id)?.name ?? "No level chosen";
  const classLabel = (c: (typeof classes)[number]) =>
    `${c.name} — ${seats.get(c.id) ?? 0}${c.capacity !== null ? `/${c.capacity}` : ""}${c.capacity !== null && (seats.get(c.id) ?? 0) >= c.capacity ? " (full)" : ""}`;

  return (
    <>
      <PageHeader kicker="Pathshala" accent="pathshala" title="Enrollments" description={term ? `Term ${term.name} · place each request into a class, waitlist or withdraw.` : undefined} />
      <TermSwitcher terms={terms} activeId={term?.id ?? null} basePath="/pathshala/enrollments" />
      {!term ? (
        <EmptyState title="No Pathshala term yet" />
      ) : (
        <>
          <Tabs
            active={status}
            tabs={STATUSES.map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), count: counts[s], href: `/pathshala/enrollments?term=${term.id}&status=${s}` }))}
          />
          {shown.length === 0 ? (
            <EmptyState title={`No ${status} enrollments`}>{status === "requested" ? "New registrations from families appear here." : ""}</EmptyState>
          ) : (
            <ul className="space-y-3">
              {shown.map((e) => {
                const p = people.find((x) => x.id === e.student_person_id);
                const name = p ? `${p.preferred_name || p.first_name} ${p.last_name}` : "Student (name hidden)";
                const hh = households.find((h) => h.id === e.household_id)?.display_name;
                const age = ageFrom(p?.date_of_birth ?? null, today);
                const suggested = classes.filter((c) => c.level_id === e.requested_level_id);
                const rest = classes.filter((c) => c.level_id !== e.requested_level_id);
                const current = classes.find((c) => c.id === e.class_id);
                return (
                  <li key={e.id}>
                    <Card>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="font-display text-lg font-semibold">{name}</p>
                          <p className="text-sm text-muted">
                            {age !== null ? `Age ${age} · ` : ""}
                            {hh ? `${hh} · ` : ""}asked for <strong className="text-ink">{levelName(e.requested_level_id)}</strong> · registered {formatDate(e.registered_at)}
                          </p>
                          {current && (
                            <p className="mt-1 text-sm">
                              <Badge tone="purple">{e.status}</Badge> <span className="ml-1">{current.name}</span>
                            </p>
                          )}
                          {e.notes && <p className="mt-1 text-sm">Note: {e.notes}</p>}
                        </div>
                        {canManage && (e.status === "requested" || e.status === "waitlisted" || e.status === "placed") && (
                          <div className="w-full max-w-md space-y-2">
                            <ActionForm action={placeEnrollment.bind(null, e.id)} submitLabel={e.status === "placed" ? "Move" : "Place"} submitClassName="btn btn-purple" layout="stack">
                              <label className="block">
                                <span className="mb-1 block text-sm font-semibold">Class</span>
                                <select name="class_id" required defaultValue={e.class_id ?? suggested[0]?.id ?? ""} className="field-input">
                                  <option value="">Choose a class</option>
                                  {suggested.length > 0 && (
                                    <optgroup label="Requested level">
                                      {suggested.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {classLabel(c)}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="Other classes">
                                    {rest.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {classLabel(c)}
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>
                              </label>
                              <label className="mt-1 flex min-h-11 items-center gap-2 text-sm">
                                <input type="checkbox" name="over_capacity" className="h-5 w-5 accent-navy" /> Place even if full
                              </label>
                            </ActionForm>
                            <div className="flex flex-wrap gap-2">
                              {e.status !== "waitlisted" && (
                                <ActionButton action={waitlistEnrollment.bind(null, e.id)} fields={{ class_id: e.class_id ?? suggested[0]?.id ?? "" }} label="Waitlist" />
                              )}
                              <ActionButton
                                action={setEnrollmentStatus.bind(null, e.id)}
                                fields={{ status: "withdrawn" }}
                                label="Withdraw"
                                className="btn btn-danger"
                                confirm={`Withdraw ${name}'s enrollment?`}
                              />
                            </div>
                          </div>
                        )}
                        {canManage && e.status === "withdrawn" && (
                          <ActionButton action={setEnrollmentStatus.bind(null, e.id)} fields={{ status: "requested" }} label="Reopen request" />
                        )}
                      </div>
                      {canManage && (
                        <div className="mt-3">
                          <Details summary="Note">
                            <ActionForm action={saveEnrollmentNote.bind(null, e.id)} submitLabel="Save note">
                              <textarea name="notes" rows={2} defaultValue={e.notes ?? ""} className="field-input" aria-label="Note" />
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
        </>
      )}
    </>
  );
}
