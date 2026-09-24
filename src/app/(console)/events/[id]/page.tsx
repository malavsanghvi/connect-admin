import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-form";
import { Badge, LoadProblem, NoAccess, PageHeader, Tabs } from "@/components/ui";
import { areas, can, hasScopedRole } from "@/lib/access";
import { resolvePeopleNames } from "@/lib/data/people";
import { formatDateTime, humanize } from "@/lib/format";
import { getSupabase, load, requireViewer, row } from "@/lib/session";
import { setEventStatus } from "../actions";
import { ChecklistTab } from "./checklist-tab";
import { DetailsTab } from "./details-tab";
import { LunchTab } from "./lunch-tab";
import { ReportTab } from "./report-tab";
import { RsvpsTab } from "./rsvps-tab";
import { VolunteersTab } from "./volunteers-tab";

export const metadata: Metadata = { title: "Event" };

const TABS = [
  { key: "details", label: "Details" },
  { key: "checklist", label: "Checklist" },
  { key: "rsvps", label: "RSVPs" },
  { key: "volunteers", label: "Volunteers" },
  { key: "lunch", label: "Lunch" },
  { key: "report", label: "Report" },
] as const;

const NEXT_STATUS: Record<string, { to: string; label: string; cls: string }[]> = {
  draft: [{ to: "published", label: "Publish (open RSVPs)", cls: "btn btn-maroon" }],
  published: [
    { to: "rsvp_closed", label: "Close RSVPs", cls: "btn btn-secondary" },
    { to: "live", label: "Go live (event day)", cls: "btn btn-success" },
  ],
  rsvp_closed: [
    { to: "published", label: "Reopen RSVPs", cls: "btn btn-secondary" },
    { to: "live", label: "Go live (event day)", cls: "btn btn-success" },
  ],
  live: [{ to: "completed", label: "Mark completed", cls: "btn btn-secondary" }],
  completed: [{ to: "live", label: "Reopen as live", cls: "btn btn-secondary" }],
  cancelled: [{ to: "draft", label: "Restore as draft", cls: "btn btn-secondary" }],
};

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]["key"]) : "details";
  const v = await requireViewer();
  const isLead = hasScopedRole(v.access, id, "event_lead");
  if (!areas.eventsAdmin(v.access) && !isLead) return <NoAccess area="this event" />;
  const canEdit = can(v.access, "events.manage") || isLead;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;

  const res = await load(async () => {
    const event = row(await supabase.from("events").select("*").eq("id", id).maybeSingle(), "the event");
    if (!event) return null;
    const names = await resolvePeopleNames(supabase, [event.owner_person_id]);
    return { event, names };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { event, names } = res.data;

  return (
    <>
      <PageHeader
        kicker={`Event${event.program_year ? ` · Pathshala ${event.program_year}` : ""}`}
        accent="events"
        title={event.name}
        back={{ href: "/events", label: "Events" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={event.status === "live" ? "success" : event.status === "cancelled" ? "danger" : event.status === "draft" ? "muted" : "navy"}>
              {humanize(event.status)}
            </Badge>
            <span>{event.starts_at ? formatDateTime(event.starts_at, tz) : "No date yet"}</span>
            {event.venue && <span>· {event.venue}</span>}
            {event.owner_person_id && <span>· Lead: {names.get(event.owner_person_id) ?? "assigned"}</span>}
          </span>
        }
        actions={
          <>
            {(can(v.access, "events.manage") || hasScopedRole(v.access, id, "event_lead", "checkin_volunteer")) && (
              <Link href={`/ops/${event.id}/checkin`} className="btn btn-secondary">
                Check-in screen
              </Link>
            )}
            {areas.kitchen(v.access, event.id) && (
              <Link href={`/ops/${event.id}/kitchen`} className="btn btn-secondary">
                Kitchen display
              </Link>
            )}
          </>
        }
      />
      {canEdit && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(NEXT_STATUS[event.status] ?? []).map((n) => (
            <ActionButton
              key={n.to}
              action={setEventStatus.bind(null, event.id)}
              fields={{ status: n.to }}
              label={n.label}
              className={n.cls}
              confirm={n.to === "published" ? "Publish this event? Members will be able to RSVP." : undefined}
            />
          ))}
          {event.status !== "cancelled" && event.status !== "completed" && (
            <ActionButton
              action={setEventStatus.bind(null, event.id)}
              fields={{ status: "cancelled" }}
              label="Cancel event"
              className="btn btn-danger"
              confirm="Cancel this event? RSVPs stay on record."
            />
          )}
        </div>
      )}
      <Tabs active={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/events/${event.id}?tab=${t.key}` }))} />
      {tab === "details" && <DetailsTab event={event} canEdit={canEdit} tz={tz} ownerName={event.owner_person_id ? (names.get(event.owner_person_id) ?? null) : null} />}
      {tab === "checklist" && <ChecklistTab event={event} viewer={v} />}
      {tab === "rsvps" && <RsvpsTab event={event} viewer={v} status={typeof sp.rsvp === "string" ? sp.rsvp : null} />}
      {tab === "volunteers" && <VolunteersTab event={event} viewer={v} />}
      {tab === "lunch" && <LunchTab event={event} viewer={v} />}
      {tab === "report" && <ReportTab event={event} viewer={v} />}
    </>
  );
}
