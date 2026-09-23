import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LoadProblem, NoAccess, PageHeader, Stat, StatGrid, TableWrap, td, th } from "@/components/ui";
import { areas } from "@/lib/access";
import { loadClasses, loadLevels, loadTeachers, loadTerms, pickTerm, levelLabel } from "@/lib/data/pathshala";
import { resolvePeopleNames } from "@/lib/data/people";
import { formatDate, todayIso } from "@/lib/format";
import { formatRate, latestClassDay, summarizeAttendance } from "@/lib/logic/attendance";
import { load, requireViewer, rows } from "@/lib/session";
import { getSupabase } from "@/lib/session";
import { TermSwitcher } from "./term-switcher";

export const metadata: Metadata = { title: "Pathshala" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PathshalaOverview({ searchParams }: { searchParams: SP }) {
  const v = await requireViewer();
  if (!areas.pathshalaAdmin(v.access)) return <NoAccess area="the Pathshala overview" />;
  const sp = await searchParams;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const today = todayIso(tz);

  const res = await load(async () => {
    const terms = await loadTerms(supabase, v.center.id);
    const term = pickTerm(terms, typeof sp.term === "string" ? sp.term : null);
    if (!term) return { terms, term: null } as const;
    const [levels, classes] = await Promise.all([loadLevels(supabase, v.center.id), loadClasses(supabase, v.center.id, term.id)]);
    const classIds = classes.map((c) => c.id);
    const day = latestClassDay(today < term.starts_on ? term.starts_on : today > term.ends_on ? term.ends_on : today);
    const [teachers, enrollments, sessions, signoffs, concerns] = await Promise.all([
      loadTeachers(supabase, classIds),
      supabase.from("pathshala_enrollments").select("id, class_id, status").eq("term_id", term.id),
      classIds.length
        ? supabase.from("pathshala_sessions").select("id, class_id").in("class_id", classIds).eq("held_on", day)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("gyan_signoffs").select("id", { count: "exact", head: true }).eq("center_id", v.center.id).eq("status", "requested"),
      supabase.from("concerns").select("id", { count: "exact", head: true }).eq("center_id", v.center.id).neq("status", "closed"),
    ]);
    const enr = rows(enrollments, "enrollments");
    const sess = rows(sessions, "class sessions");
    if (signoffs.error) console.error("[pathshala] sign-off count failed", signoffs.error);
    if (concerns.error) console.error("[pathshala] concern count failed", concerns.error);
    const marks = sess.length
      ? rows(
          await supabase.from("pathshala_attendance").select("session_id, enrollment_id, status").in("session_id", sess.map((s) => s.id)),
          "attendance",
        )
      : [];
    const names = await resolvePeopleNames(supabase, teachers.map((t) => t.person_id));
    return {
      terms,
      term,
      levels,
      classes,
      teachers,
      names,
      enr,
      sess,
      marks,
      day,
      signoffsPending: signoffs.error ? null : (signoffs.count ?? 0),
      openConcerns: concerns.error ? null : (concerns.count ?? 0),
    } as const;
  });

  if (!res.ok) return <LoadProblem message={res.error} />;
  const d = res.data;

  if (!d.term) {
    return (
      <>
        <PageHeader kicker="Pathshala" accent="pathshala" title="Pathshala" />
        <EmptyState title="No Pathshala term yet">
          <Link className="font-semibold text-navy underline" href="/pathshala/terms">
            Create the first term
          </Link>{" "}
          to set dates, fees and registration.
        </EmptyState>
      </>
    );
  }

  const { term, classes, levels, teachers, names, enr, sess, marks, day } = d;
  const placed = enr.filter((e) => e.status === "placed" || e.status === "active");
  const waitlisted = enr.filter((e) => e.status === "waitlisted").length;
  const requested = enr.filter((e) => e.status === "requested").length;
  const isNoClass = term.no_class_dates.includes(day);
  const dayLabel = day === today ? "Today" : `Last class day (${formatDate(day)})`;

  return (
    <>
      <PageHeader
        kicker="Pathshala"
        accent="pathshala"
        title={`Term ${term.name}`}
        description={`${formatDate(term.starts_on)} – ${formatDate(term.ends_on)} · ${term.status}`}
        actions={
          <>
            <Link href="/pathshala/enrollments" className="btn btn-purple">
              Enrollment requests{requested ? ` (${requested})` : ""}
            </Link>
            <Link href="/pathshala/classes" className="btn btn-secondary">
              Classes
            </Link>
          </>
        }
      />
      <TermSwitcher terms={d.terms} activeId={term.id} basePath="/pathshala" />
      <StatGrid>
        <Stat label="Students placed" value={placed.length} sub={`${classes.length} classes`} tone="purple" />
        <Stat label="Waitlist" value={waitlisted} sub={`${requested} requests to place`} tone="warning" />
        <Stat
          label="Gyan Path sign-offs"
          value={d.signoffsPending ?? "—"}
          sub={<Link className="underline" href="/pathshala/signoffs">awaiting teachers</Link>}
          tone="navy"
        />
        <Stat
          label="Open concerns"
          value={d.openConcerns ?? "—"}
          sub={<Link className="underline" href="/pathshala/committee/concerns">teachers and parents</Link>}
          tone="maroon"
        />
      </StatGrid>

      <Card title="Classes" description={`Attendance column: ${dayLabel}${isNoClass ? " — no class that day" : ""}.`}>
        {classes.length === 0 ? (
          <EmptyState title="No classes in this term">
            <Link className="font-semibold text-navy underline" href="/pathshala/classes">Add classes</Link> for each level.
          </EmptyState>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={th}>Class</th>
                  <th className={th}>Teachers</th>
                  <th className={th}>Enrolled</th>
                  <th className={th}>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const roster = placed.filter((e) => e.class_id === c.id).map((e) => e.id);
                  const wl = enr.filter((e) => e.class_id === c.id && e.status === "waitlisted").length;
                  const session = sess.find((s) => s.class_id === c.id);
                  const summary = summarizeAttendance(roster, session ? marks.filter((m) => m.session_id === session.id) : []);
                  const tNames = teachers
                    .filter((t) => t.class_id === c.id)
                    .map((t) => `${names.get(t.person_id) ?? "Teacher"}${t.role !== "teacher" ? ` (${t.role})` : ""}`);
                  const full = c.capacity !== null && roster.length >= c.capacity;
                  return (
                    <tr key={c.id}>
                      <td className={td}>
                        <Link href={`/pathshala/classes/${c.id}`} className="font-semibold text-navy hover:underline">
                          {c.name}
                        </Link>
                        <div className="text-xs text-muted">
                          {levelLabel(levels, c.level_id)}
                          {c.room ? ` · ${c.room}` : ""}
                        </div>
                      </td>
                      <td className={td}>{tNames.length ? tNames.join(", ") : <Badge tone="warning">No teacher</Badge>}</td>
                      <td className={td}>
                        <span className="font-semibold">{roster.length}</span>
                        {c.capacity !== null && <span className="text-muted"> / {c.capacity}</span>}
                        {full && <span className="ml-2"><Badge tone="warning">Full</Badge></span>}
                        {wl > 0 && <div className="text-xs text-muted">{wl} waitlisted</div>}
                      </td>
                      <td className={td}>
                        {isNoClass ? (
                          <Badge tone="muted">No class</Badge>
                        ) : summary.state === "not_taken" ? (
                          <Badge tone="danger">Not taken</Badge>
                        ) : summary.state === "partial" ? (
                          <Badge tone="warning">
                            Partial · {summary.unmarked} unmarked
                          </Badge>
                        ) : (
                          <Badge tone="success">
                            Done · {formatRate(summary.rate)} present
                          </Badge>
                        )}
                        {summary.state !== "not_taken" && (
                          <div className="text-xs text-muted">
                            {summary.present} present · {summary.late} late · {summary.absent} absent · {summary.excused} excused
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
