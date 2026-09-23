import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, EmptyState, LoadProblem, NoAccess, PageHeader, Tabs } from "@/components/ui";
import { areas } from "@/lib/access";
import { resolvePeopleNames, resolveUserNames } from "@/lib/data/people";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { decideSignoff } from "../actions";

export const metadata: Metadata = { title: "Gyan Path sign-offs" };

export default async function SignoffsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.signoffs(v.access)) return <NoAccess area="Gyan Path sign-offs" />;
  const sp = await searchParams;
  const view = sp.view === "decided" ? "decided" : "waiting";
  const supabase = await getSupabase();

  const res = await load(async () => {
    let q = supabase.from("gyan_signoffs").select("*").eq("center_id", v.center.id);
    q = view === "waiting" ? q.eq("status", "requested").order("requested_at") : q.neq("status", "requested").order("decided_at", { ascending: false }).limit(100);
    const signoffs = rows(await q, "sign-off requests");
    const levelIds = [...new Set(signoffs.map((s) => s.level_id))];
    const personIds = [...new Set(signoffs.map((s) => s.person_id))];
    const [levels, enrollments, names, deciders] = await Promise.all([
      levelIds.length ? supabase.from("gyan_levels").select("id, name, key, goal_id, treasure").in("id", levelIds) : Promise.resolve({ data: [], error: null }),
      personIds.length
        ? supabase.from("pathshala_enrollments").select("student_person_id, class_id").in("student_person_id", personIds).in("status", ["placed", "active"])
        : Promise.resolve({ data: [], error: null }),
      resolvePeopleNames(supabase, personIds),
      resolveUserNames(supabase, v.center.id, signoffs.map((s) => s.teacher_user)),
    ]);
    const lv = rows(levels, "Gyan Path levels");
    const goalIds = [...new Set(lv.map((l) => l.goal_id))];
    const en = rows(enrollments, "class placements");
    const classIds = [...new Set(en.map((e) => e.class_id).filter((x): x is string => Boolean(x)))];
    const [goals, classes] = await Promise.all([
      goalIds.length ? supabase.from("gyan_goals").select("id, name").in("id", goalIds) : Promise.resolve({ data: [], error: null }),
      classIds.length ? supabase.from("pathshala_classes").select("id, name").in("id", classIds) : Promise.resolve({ data: [], error: null }),
    ]);
    return { signoffs, levels: lv, goals: rows(goals, "Gyan Path goals"), enrollments: en, classes: rows(classes, "classes"), names, deciders };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const d = res.data;

  return (
    <>
      <PageHeader
        kicker="Pathshala"
        accent="pathshala"
        title="Gyan Path sign-offs"
        description="Final Gyan Path levels need a teacher's sign-off before they count. You see students in the classes you teach."
      />
      <Tabs
        active={view}
        tabs={[
          { key: "waiting", label: "Waiting", href: "/pathshala/signoffs" },
          { key: "decided", label: "Decided", href: "/pathshala/signoffs?view=decided" },
        ]}
      />
      {d.signoffs.length === 0 ? (
        <EmptyState title={view === "waiting" ? "No sign-offs waiting" : "Nothing decided yet"}>
          {view === "waiting" ? "When a student finishes a level that needs you, it shows up here." : ""}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {d.signoffs.map((s) => {
            const level = d.levels.find((l) => l.id === s.level_id);
            const goal = d.goals.find((g) => g.id === level?.goal_id);
            const classNames = d.enrollments
              .filter((e) => e.student_person_id === s.person_id)
              .map((e) => d.classes.find((c) => c.id === e.class_id)?.name)
              .filter(Boolean);
            const student = d.names.get(s.person_id) ?? "Student";
            return (
              <li key={s.id}>
                <Card>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-display text-lg font-semibold">{student}</p>
                      <p className="text-sm">
                        {goal?.name ?? "Gyan Path"} · <strong>Level {level?.key}: {level?.name ?? "—"}</strong>
                      </p>
                      <p className="text-xs text-muted">
                        {classNames.length ? `${classNames.join(", ")} · ` : ""}asked {formatDate(s.requested_at)}
                        {level?.treasure ? ` · reward: ${level.treasure}` : ""}
                      </p>
                      {s.status !== "requested" && (
                        <p className="mt-2 text-sm">
                          <Badge tone={s.status === "approved" ? "success" : "warning"}>{s.status === "approved" ? "Signed off" : "Needs work"}</Badge>{" "}
                          <span className="text-muted">
                            by {d.deciders.get(s.teacher_user ?? "") ?? (s.teacher_user === v.userId ? "you" : "a teacher")} · {formatDateTime(s.decided_at, v.center.time_zone)}
                          </span>
                          {s.note && <span className="block">Note: {s.note}</span>}
                        </p>
                      )}
                    </div>
                    {s.status === "requested" && (
                      <div className="w-full md:max-w-sm">
                        <ActionForm
                          action={decideSignoff.bind(null, s.id)}
                          submitLabel="✓ Sign off"
                          submitClassName="btn btn-success min-h-12 flex-1"
                          pendingLabel="Saving…"
                          successMessage="Done."
                          extraButtons={
                            <button type="submit" name="decision" value="needs_work" className="btn btn-danger min-h-12 flex-1">
                              Needs work
                            </button>
                          }
                        >
                          <label className="block">
                            <span className="mb-1 block text-sm font-semibold">Note to the student</span>
                            <textarea name="note" rows={2} className="field-input" placeholder="Required for “Needs work”" />
                          </label>
                        </ActionForm>
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
