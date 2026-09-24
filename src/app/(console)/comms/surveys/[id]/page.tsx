import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, Details, EmptyState, Field, FormGrid, LoadProblem, NoAccess, PageHeader, TableWrap, td, th } from "@/components/ui";
import { can } from "@/lib/access";
import { resolvePeopleNames } from "@/lib/data/people";
import { formatDateTime, humanize, toDateTimeLocal } from "@/lib/format";
import { getSupabase, load, requireViewer, row, rows } from "@/lib/session";
import { saveSurvey, setSurveyStatus } from "../../actions";
import { AudienceFields } from "../../audience-fields";
import { QuestionsBuilder, type SurveyQuestion } from "../../questions-builder";
import { loadAudienceOptions } from "../../shared";

export const metadata: Metadata = { title: "Survey" };

function answerText(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer();
  if (!can(v.access, "comms.view", "comms.send")) return <NoAccess area="surveys" />;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const res = await load(async () => {
    const s = row(await supabase.from("surveys").select("*").eq("id", id).maybeSingle(), "the survey");
    if (!s) return null;
    const responses = rows(await supabase.from("survey_responses").select("*").eq("survey_id", id).order("submitted_at", { ascending: false }).limit(500), "responses");
    const [options, names] = await Promise.all([loadAudienceOptions(supabase, v.center.id), resolvePeopleNames(supabase, responses.map((r) => r.person_id))]);
    return { s, responses, options, names };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { s, responses, options, names } = res.data;
  const questions = (Array.isArray(s.questions) ? s.questions : []) as SurveyQuestion[];
  const canSend = can(v.access, "comms.send");

  return (
    <>
      <PageHeader
        title={s.title}
        back={{ href: "/comms?tab=surveys", label: "Surveys" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={s.status === "open" ? "success" : s.status === "closed" ? "neutral" : "muted"}>{humanize(s.status)}</Badge>
            {responses.length} responses{s.anonymous ? " · anonymous" : ""}
            {s.closes_at ? ` · closes ${formatDateTime(s.closes_at, tz)}` : ""}
          </span>
        }
      />
      {canSend && (
        <div className="mb-6 flex flex-wrap gap-2">
          {s.status === "draft" && <ActionButton action={setSurveyStatus.bind(null, s.id)} fields={{ status: "open" }} label="Open survey" className="btn btn-primary" confirm="Open this survey to members?" />}
          {s.status === "open" && <ActionButton action={setSurveyStatus.bind(null, s.id)} fields={{ status: "closed" }} label="Close survey" className="btn btn-danger" />}
          {s.status === "closed" && <ActionButton action={setSurveyStatus.bind(null, s.id)} fields={{ status: "open" }} label="Reopen" />}
        </div>
      )}
      <Card title="Responses" className="mb-6">
        {responses.length === 0 ? (
          <EmptyState title="No responses yet" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  {!s.anonymous && <th className={th}>From</th>}
                  <th className={th}>When</th>
                  {questions.map((q) => (
                    <th key={q.id} className={th}>
                      {q.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => {
                  const answers = (r.answers ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={r.id}>
                      {!s.anonymous && <td className={td}>{r.person_id ? (names.get(r.person_id) ?? "Member") : "Anonymous"}</td>}
                      <td className={td}>{formatDateTime(r.submitted_at, tz)}</td>
                      {questions.map((q) => (
                        <td key={q.id} className={td}>
                          {answerText(answers[q.id])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {canSend && (
        <Details summary={s.status === "draft" ? "Edit survey" : "Edit survey (it's live — changes show immediately)"}>
          <ActionForm action={saveSurvey.bind(null, s.id)} submitLabel="Save survey">
            <div className="space-y-4">
              <Field label="Title">
                <input name="title" required defaultValue={s.title} className="field-input" />
              </Field>
              <Field label="Intro">
                <textarea name="description" rows={2} defaultValue={s.description ?? ""} className="field-input" />
              </Field>
              <QuestionsBuilder initial={questions} />
              <FormGrid>
                <Field label="Opens">
                  <input type="datetime-local" name="opens_at" defaultValue={toDateTimeLocal(s.opens_at, tz)} className="field-input" />
                </Field>
                <Field label="Closes">
                  <input type="datetime-local" name="closes_at" defaultValue={toDateTimeLocal(s.closes_at, tz)} className="field-input" />
                </Field>
              </FormGrid>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="anonymous" defaultChecked={s.anonymous} className="h-5 w-5 accent-navy" /> Anonymous answers
              </label>
              <AudienceFields zones={options.zones} classes={options.classes} events={options.events} initial={s.audience} />
            </div>
          </ActionForm>
        </Details>
      )}
    </>
  );
}
