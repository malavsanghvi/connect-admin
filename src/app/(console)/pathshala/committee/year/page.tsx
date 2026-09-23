import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, Details, EmptyState, Field, LoadProblem, NoAccess, Notice, PageHeader } from "@/components/ui";
import { can } from "@/lib/access";
import { formatDate, todayIso } from "@/lib/format";
import { pathshalaYearFor } from "@/lib/logic/eams";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { createYear } from "../actions";

export const metadata: Metadata = { title: "Create Pathshala year" };

function nextYear(label: string) {
  const start = Number(label.slice(0, 4)) + 1;
  return `${start}-${start + 1}`;
}

export default async function YearPage() {
  const v = await requireViewer();
  if (!can(v.access, "events.view", "events.manage")) return <NoAccess area="Pathshala year planning" />;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const res = await load(async () => {
    const [templates, events] = await Promise.all([
      supabase.from("event_templates").select("id, name, description").eq("center_id", v.center.id).order("name"),
      supabase.from("events").select("id, name, starts_at, program_year, template_id").eq("center_id", v.center.id).not("program_year", "is", null).order("starts_at", { nullsFirst: true }),
    ]);
    return { templates: rows(templates, "templates"), events: rows(events, "Pathshala year events") };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { templates, events } = res.data;
  const years = [...new Set(events.map((e) => e.program_year!))].sort().reverse();
  const current = pathshalaYearFor(todayIso(tz));
  const suggested = years.includes(current) ? nextYear(current) : current;
  const manage = can(v.access, "events.manage");

  return (
    <>
      <PageHeader
        title="Create a Pathshala year"
        accent="pathshala"
        description="Makes one event per template, with the template's before, during and after checklist as actions. Dates are optional — set them now or later on each event."
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {!manage ? (
            <Notice>Only committee members who manage events can create a year.</Notice>
          ) : templates.length === 0 ? (
            <EmptyState title="No templates yet">
              <Link className="font-semibold text-navy underline" href="/pathshala/committee/templates">Create templates</Link> first.
            </EmptyState>
          ) : (
            <Card>
              <ActionForm
                action={createYear}
                submitLabel="Create the year"
                pendingLabel="Creating events…"
                submitClassName="btn btn-purple"
                confirm="Create one event for each ticked template?"
              >
                <Field label="Pathshala year" hint={years.length ? `Existing: ${years.join(", ")}` : "No years yet"}>
                  <input name="program_year" required defaultValue={suggested} pattern="\d{4}-\d{4}" className="field-input" />
                </Field>
                <ul className="mt-4 divide-y divide-line">
                  {templates.map((t) => (
                    <li key={t.id} className="py-3">
                      <label className="flex min-h-11 items-start gap-3">
                        <input type="checkbox" name="template_id" value={t.id} defaultChecked className="mt-1 h-5 w-5 accent-purple" />
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold">{t.name}</span>
                          {t.description && <span className="block text-xs text-muted">{t.description}</span>}
                        </span>
                      </label>
                      <input type="hidden" name={`default_name_${t.id}`} value={t.name} />
                      <div className="ml-8 mt-2 grid gap-2 sm:grid-cols-2">
                        <Field label="Event name">
                          <input name={`name_${t.id}`} defaultValue={t.name} className="field-input" />
                        </Field>
                        <Field label="Date (optional)">
                          <input type="date" name={`date_${t.id}`} className="field-input" />
                        </Field>
                      </div>
                    </li>
                  ))}
                </ul>
              </ActionForm>
            </Card>
          )}
        </div>
        <div className="space-y-4 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Existing years</h2>
          {years.length === 0 ? (
            <p className="text-sm text-muted">None yet.</p>
          ) : (
            years.map((y) => {
              const evs = events.filter((e) => e.program_year === y);
              return (
                <Details key={y} summary={`${y} · ${evs.length} events`} open={y === current}>
                  <ul className="space-y-1 text-sm">
                    {evs.map((e) => (
                      <li key={e.id} className="flex justify-between gap-2">
                        <Link className="font-semibold text-navy hover:underline" href={`/events/${e.id}?tab=checklist`}>
                          {e.name}
                        </Link>
                        <span className="text-muted">{e.starts_at ? formatDate(e.starts_at, tz) : "No date"}</span>
                      </li>
                    ))}
                  </ul>
                </Details>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
