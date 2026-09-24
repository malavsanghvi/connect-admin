import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LoadProblem, NoAccess, PageHeader } from "@/components/ui";
import { areas, hasCenterRole, teacherClassIds } from "@/lib/access";
import { loadTerms, pickTerm } from "@/lib/data/pathshala";
import { formatDate, humanize, todayIso } from "@/lib/format";
import { formatRate, latestClassDay, nextClassDay, summarizeAttendance } from "@/lib/logic/attendance";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";

export const metadata: Metadata = { title: "My classes" };

export default async function MyClassesPage() {
  const v = await requireViewer();
  if (!areas.teaches(v.access)) {
    return <NoAccess>My classes is for Pathshala teachers. Your login doesn&apos;t have a teacher role for any class yet — ask the Pathshala principal.</NoAccess>;
  }
  const supabase = await getSupabase();
  const today = todayIso(v.center.time_zone);

  const res = await load(async () => {
    let classes;
    if (hasCenterRole(v.access, "teacher")) {
      const term = pickTerm(await loadTerms(supabase, v.center.id));
      classes = term ? rows(await supabase.from("pathshala_classes").select("*").eq("term_id", term.id).order("name"), "your classes") : [];
    } else {
      const ids = teacherClassIds(v.access);
      classes = ids.length ? rows(await supabase.from("pathshala_classes").select("*").in("id", ids).order("name"), "your classes") : [];
    }
    const ids = classes.map((c) => c.id);
    if (!ids.length) return { classes, levels: [], terms: [], enr: [], sessions: [], marks: [], signoffs: [] };
    const [levels, terms, enr, sessions] = await Promise.all([
      supabase.from("pathshala_levels").select("id, name").in("id", classes.map((c) => c.level_id)),
      supabase.from("pathshala_terms").select("id, name, no_class_dates").in("id", classes.map((c) => c.term_id)),
      supabase.from("pathshala_enrollments").select("id, class_id, status, student_person_id").in("class_id", ids).in("status", ["placed", "active"]),
      supabase
        .from("pathshala_sessions")
        .select("id, class_id, held_on")
        .in("class_id", ids)
        .in("held_on", [...new Set(classes.map((c) => latestClassDay(today, c.meets_on)))]),
    ]);
    const s = rows(sessions, "class days");
    const e = rows(enr, "rosters");
    const [marks, signoffs] = await Promise.all([
      s.length ? supabase.from("pathshala_attendance").select("session_id, enrollment_id, status").in("session_id", s.map((x) => x.id)) : Promise.resolve({ data: [], error: null }),
      e.length
        ? supabase.from("gyan_signoffs").select("id, person_id").eq("status", "requested").in("person_id", e.map((x) => x.student_person_id))
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (signoffs.error) console.error("[my-classes] sign-off count failed", signoffs.error);
    return {
      classes,
      levels: rows(levels, "levels"),
      terms: rows(terms, "terms"),
      enr: e,
      sessions: s,
      marks: rows(marks, "attendance"),
      signoffs: signoffs.data ?? [],
    };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const d = res.data;

  return (
    <>
      <PageHeader kicker="Pathshala" accent="pathshala" title="My classes" description={`Welcome, ${v.displayName}. Tap a class to take attendance.`} />
      {d.classes.length === 0 ? (
        <EmptyState title="No classes yet">You&apos;ll see your classes here once the principal assigns you.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {d.classes.map((c) => {
            const day = latestClassDay(today, c.meets_on);
            const next = nextClassDay(today, c.meets_on);
            const roster = d.enr.filter((e) => e.class_id === c.id);
            const session = d.sessions.find((s) => s.class_id === c.id && s.held_on === day);
            const sum = summarizeAttendance(roster.map((r) => r.id), session ? d.marks.filter((m) => m.session_id === session.id) : []);
            const pending = d.signoffs.filter((s) => roster.some((r) => r.student_person_id === s.person_id)).length;
            const term = d.terms.find((t) => t.id === c.term_id);
            const noClass = term?.no_class_dates.includes(day);
            return (
              <Card key={c.id}>
                <p className="text-xs font-bold uppercase tracking-wider text-purple">{d.levels.find((l) => l.id === c.level_id)?.name ?? "Class"}</p>
                <h2 className="font-display text-xl font-semibold">{c.name}</h2>
                <p className="text-sm text-muted">
                  {humanize(c.meets_on)}
                  {c.starts_time ? ` ${c.starts_time.slice(0, 5)}` : ""}
                  {c.room ? ` · ${c.room}` : ""} · {roster.length} students
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">{day === today ? "Today" : formatDate(day)}:</span>
                  {noClass ? (
                    <Badge tone="muted">No class</Badge>
                  ) : sum.state === "complete" ? (
                    <Badge tone="success">Attendance done · {formatRate(sum.rate)}</Badge>
                  ) : sum.state === "partial" ? (
                    <Badge tone="warning">{sum.unmarked} not marked yet</Badge>
                  ) : (
                    <Badge tone="danger">Attendance not taken</Badge>
                  )}
                  {pending > 0 && <Badge tone="navy">{pending} sign-off{pending === 1 ? "" : "s"} waiting</Badge>}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Link href={`/pathshala/classes/${c.id}/attendance?date=${day}`} className="btn btn-purple min-h-14 text-base">
                    Take attendance
                  </Link>
                  <Link href={`/pathshala/classes/${c.id}`} className="btn btn-secondary min-h-14">
                    Roster
                  </Link>
                  <Link href={`/pathshala/signoffs`} className="btn btn-secondary">
                    Sign-offs
                  </Link>
                  <Link href={`/pathshala/announcements?class=${c.id}`} className="btn btn-secondary">
                    Announce to parents
                  </Link>
                </div>
                {next !== day && <p className="mt-2 text-xs text-muted">Next class: {formatDate(next)}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
