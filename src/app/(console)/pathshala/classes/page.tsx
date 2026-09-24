import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LoadProblem, NoAccess, PageHeader, TableWrap, td, th } from "@/components/ui";
import { areas } from "@/lib/access";
import { loadClasses, loadLevels, loadTeachers, loadTerms, pickTerm } from "@/lib/data/pathshala";
import { resolvePeopleNames } from "@/lib/data/people";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { TermSwitcher } from "../term-switcher";
import { ClassForm } from "./class-form";

export const metadata: Metadata = { title: "Pathshala classes" };

export default async function ClassesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.pathshalaAdmin(v.access)) return <NoAccess area="Pathshala classes" />;
  const sp = await searchParams;
  const supabase = await getSupabase();
  const res = await load(async () => {
    const [terms, levels] = await Promise.all([loadTerms(supabase, v.center.id), loadLevels(supabase, v.center.id)]);
    const term = pickTerm(terms, typeof sp.term === "string" ? sp.term : null);
    const classes = term ? await loadClasses(supabase, v.center.id, term.id) : [];
    const ids = classes.map((c) => c.id);
    const [teachers, enr] = await Promise.all([
      loadTeachers(supabase, ids),
      ids.length ? supabase.from("pathshala_enrollments").select("class_id, status").in("class_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    const names = await resolvePeopleNames(supabase, teachers.map((t) => t.person_id));
    return { terms, levels, term, classes, teachers, names, enr: rows(enr, "enrollments") };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { terms, levels, term, classes, teachers, names, enr } = res.data;
  const canEdit = areas.pathshalaManage(v.access);

  const byTrack = new Map<string, typeof classes>();
  for (const c of classes) {
    const track = levels.find((l) => l.id === c.level_id)?.track_name ?? "Other";
    byTrack.set(track, [...(byTrack.get(track) ?? []), c]);
  }
  const levelOrder = (id: string) => levels.findIndex((l) => l.id === id);

  return (
    <>
      <PageHeader kicker="Pathshala" accent="pathshala" title="Classes" description={term ? `Term ${term.name}` : "No term yet"} />
      <TermSwitcher terms={terms} activeId={term?.id ?? null} basePath="/pathshala/classes" />
      {!term ? (
        <EmptyState title="Create a term first">
          <Link className="font-semibold text-navy underline" href="/pathshala/terms">Go to terms</Link>
        </EmptyState>
      ) : classes.length === 0 ? (
        <EmptyState title="No classes in this term yet">{canEdit ? "Add the first class below." : ""}</EmptyState>
      ) : (
        <div className="space-y-6">
          {[...byTrack.entries()].map(([track, cs]) => (
            <Card key={track} title={track}>
              <TableWrap>
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr>
                      <th className={th}>Class</th>
                      <th className={th}>Teachers</th>
                      <th className={th}>Roster</th>
                      <th className={th}>Waitlist</th>
                      <th className={th}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cs].sort((a, b) => levelOrder(a.level_id) - levelOrder(b.level_id) || a.name.localeCompare(b.name)).map((c) => {
                      const roster = enr.filter((e) => e.class_id === c.id && (e.status === "placed" || e.status === "active")).length;
                      const wl = enr.filter((e) => e.class_id === c.id && e.status === "waitlisted").length;
                      const t = teachers.filter((x) => x.class_id === c.id);
                      return (
                        <tr key={c.id}>
                          <td className={td}>
                            <Link href={`/pathshala/classes/${c.id}`} className="font-semibold text-navy hover:underline">
                              {c.name}
                            </Link>
                            <div className="text-xs text-muted">{levels.find((l) => l.id === c.level_id)?.name}{c.room ? ` · ${c.room}` : ""}</div>
                          </td>
                          <td className={td}>
                            {t.length ? t.map((x) => names.get(x.person_id) ?? "Teacher").join(", ") : <Badge tone="warning">Needs a teacher</Badge>}
                          </td>
                          <td className={td}>
                            {roster}
                            {c.capacity !== null ? ` / ${c.capacity}` : ""}
                          </td>
                          <td className={td}>{wl || "—"}</td>
                          <td className={td}>
                            <span className="capitalize">{c.meets_on}</span>
                            {c.starts_time ? ` ${c.starts_time.slice(0, 5)}` : ""}
                            {c.ends_time ? `–${c.ends_time.slice(0, 5)}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          ))}
        </div>
      )}
      {canEdit && terms.length > 0 && (
        <Card title="New class" className="mt-6">
          <ClassForm cls={null} terms={terms} levels={levels} defaultTermId={term?.id ?? null} />
        </Card>
      )}
    </>
  );
}
