import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Card, LoadProblem, NoAccess, Notice, PageHeader } from "@/components/ui";
import { areas, can, hasScopedRole } from "@/lib/access";
import { formatDate, todayIso } from "@/lib/format";
import { classDaysInTerm, isAttendanceStatus, latestClassDay, type AttendanceStatus } from "@/lib/logic/attendance";
import { getSupabase, load, requireViewer, row, rows } from "@/lib/session";
import { saveSessionTopic } from "../../../actions";
import { AttendanceSheet } from "./attendance-sheet";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await requireViewer();
  const canMark = hasScopedRole(v.access, id, "teacher") || can(v.access, "pathshala.manage");
  if (!canMark && !areas.pathshalaAdmin(v.access)) return <NoAccess area="attendance for this class" />;
  const supabase = await getSupabase();
  const today = todayIso(v.center.time_zone);

  const res = await load(async () => {
    const cls = row(await supabase.from("pathshala_classes").select("*").eq("id", id).maybeSingle(), "the class");
    if (!cls) return null;
    const requested = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
    const heldOn = requested ?? latestClassDay(today, cls.meets_on);
    const [term, enrollments, session] = await Promise.all([
      supabase.from("pathshala_terms").select("id, name, starts_on, ends_on, no_class_dates").eq("id", cls.term_id).maybeSingle(),
      supabase.from("pathshala_enrollments").select("id, student_person_id, status").eq("class_id", id).in("status", ["placed", "active"]),
      supabase.from("pathshala_sessions").select("*").eq("class_id", id).eq("held_on", heldOn).maybeSingle(),
    ]);
    const enr = rows(enrollments, "the class roster");
    const sess = row(session, "the class session");
    const [people, marks] = await Promise.all([
      enr.length
        ? supabase.from("people").select("id, first_name, last_name, preferred_name").in("id", enr.map((e) => e.student_person_id))
        : Promise.resolve({ data: [], error: null }),
      sess ? supabase.from("pathshala_attendance").select("enrollment_id, status, note").eq("session_id", sess.id) : Promise.resolve({ data: [], error: null }),
    ]);
    return { cls, heldOn, term: row(term, "the term"), enr, sess, people: rows(people, "student names"), marks: rows(marks, "attendance") };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { cls, heldOn, term, enr, sess, people, marks } = res.data;

  const students = enr
    .map((e) => {
      const p = people.find((x) => x.id === e.student_person_id);
      return { enrollmentId: e.id, name: p ? `${p.preferred_name || p.first_name} ${p.last_name}` : "Student (name hidden)" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const serverMarks: Record<string, { status: AttendanceStatus; note: string | null }> = {};
  for (const m of marks) if (isAttendanceStatus(m.status)) serverMarks[m.enrollment_id] = { status: m.status, note: m.note };

  const recentDays = term ? classDaysInTerm(term.starts_on, term.ends_on, cls.meets_on, term.no_class_dates).filter((d) => d <= today).slice(-6).reverse() : [];
  const noClass = term?.no_class_dates.includes(heldOn);
  const outsideTerm = term && (heldOn < term.starts_on || heldOn > term.ends_on);
  const qr = sess?.attendance_token && sess.token_expires_at && sess.token_expires_at > new Date().toISOString()
    ? { token: sess.attendance_token, expiresAt: sess.token_expires_at }
    : null;

  return (
    <>
      <PageHeader
        kicker="Attendance"
        accent="pathshala"
        title={cls.name}
        description={heldOn === today ? `Today, ${formatDate(heldOn)}` : formatDate(heldOn)}
        back={{ href: `/pathshala/classes/${cls.id}`, label: "Class" }}
      />

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Class date</span>
            <input type="date" name="date" defaultValue={heldOn} className="field-input" />
          </label>
          <button type="submit" className="btn btn-secondary">
            Open date
          </button>
        </form>
        {recentDays.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {recentDays.map((d) => (
              <Link
                key={d}
                href={`?date=${d}`}
                aria-current={d === heldOn ? "date" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold ${d === heldOn ? "border-purple bg-purple text-white" : "border-line bg-white text-purple"}`}
              >
                {formatDate(d)}
              </Link>
            ))}
          </div>
        )}
      </Card>

      {(noClass || outsideTerm) && (
        <div className="mb-4">
          <Notice tone="warning">
            {noClass ? "This date is marked as a no-class day in the term calendar." : "This date is outside the term."} You can still record attendance if class
            did meet.
          </Notice>
        </div>
      )}
      {!canMark && (
        <div className="mb-4">
          <Notice>You can view attendance for this class but not change it.</Notice>
        </div>
      )}

      <AttendanceSheet classId={cls.id} heldOn={heldOn} students={students} serverMarks={serverMarks} readOnly={!canMark} qr={qr} />

      {canMark && (
        <Card title="Topic taught" className="mt-6">
          <ActionForm action={saveSessionTopic.bind(null, cls.id, heldOn)} submitLabel="Save topic">
            <input name="topic" defaultValue={sess?.topic ?? ""} placeholder="e.g. Navkar Mantra – meaning of each line" className="field-input" aria-label="Topic" />
          </ActionForm>
        </Card>
      )}
    </>
  );
}
