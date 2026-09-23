import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Details, EmptyState, Field, FormGrid, LoadProblem, Stat, StatGrid } from "@/components/ui";
import { can, hasScopedRole } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { formatDateTime, formatTime, humanize } from "@/lib/format";
import { eventReport } from "@/lib/logic/event-report";
import { getSupabase, load, rows, type Viewer } from "@/lib/session";
import { addGuestRsvp, setRsvpStatus } from "../actions";

const STATUSES = ["rsvpd", "confirmed", "attended", "waitlisted", "no_show", "cancelled", "invited"];

function statusLabel(s: string) {
  return s === "rsvpd" ? "RSVP'd" : humanize(s);
}

export async function RsvpsTab({ event, viewer, status }: { event: Tables<"events">; viewer: Viewer; status: string | null }) {
  const supabase = await getSupabase();
  const tz = viewer.center.time_zone;
  const res = await load(async () => {
    const [rsvps, attendees, slots] = await Promise.all([
      supabase.from("rsvps").select("*").eq("event_id", event.id).order("created_at"),
      supabase.from("attendees").select("*").eq("event_id", event.id).order("display_name"),
      supabase.from("lunch_slots").select("id, starts_at").eq("event_id", event.id),
    ]);
    const r = rows(rsvps, "RSVPs");
    const householdIds = [...new Set(r.map((x) => x.household_id).filter((x): x is string => Boolean(x)))];
    const households = householdIds.length ? await supabase.from("households").select("id, display_name").in("id", householdIds) : { data: [], error: null };
    // Household names need people.view; event leads see attendee names instead.
    if (households.error) console.error("[rsvps] household names unavailable", households.error);
    return { rsvps: r, attendees: rows(attendees, "attendees"), slots: rows(slots, "lunch slots"), households: households.data ?? [] };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { rsvps, attendees, slots, households } = res.data;
  const report = eventReport(rsvps, attendees);
  const canEdit = can(viewer.access, "events.manage") || hasScopedRole(viewer.access, event.id, "event_lead");
  const shown = status ? rsvps.filter((r) => r.status === status) : rsvps;
  const label = (r: (typeof rsvps)[number]) => {
    const hh = r.household_id ? households.find((h) => h.id === r.household_id)?.display_name : null;
    if (hh) return hh;
    if (r.guest_name) return r.guest_name;
    const first = attendees.find((a) => a.rsvp_id === r.id);
    return first ? `${first.display_name}'s party` : "RSVP";
  };

  return (
    <>
      <StatGrid>
        <Stat label="RSVP'd people" value={report.rsvpdPeople} sub={`${report.householdsTotal - (report.households.cancelled ?? 0)} households`} tone="maroon" />
        <Stat label="Confirmed" value={report.confirmedPeople} sub={`of ${report.rsvpdPeople} RSVP'd`} tone="navy" />
        <Stat label="Checked in" value={report.checkedIn} sub={`${report.walkIns} walk-ins`} tone="success" />
        <Stat
          label="Flags"
          value={report.flags.childUnder12 + report.flags.senior + report.flags.assistance}
          sub={`${report.flags.childUnder12} under 12 · ${report.flags.senior} seniors · ${report.flags.assistance} assistance`}
          tone="warning"
        />
      </StatGrid>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/events/${event.id}?tab=rsvps`}
          className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${!status ? "border-maroon bg-maroon text-white" : "border-line bg-white text-maroon"}`}
        >
          All ({rsvps.length})
        </Link>
        {STATUSES.filter((s) => report.households[s]).map((s) => (
          <Link
            key={s}
            href={`/events/${event.id}?tab=rsvps&rsvp=${s}`}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${status === s ? "border-maroon bg-maroon text-white" : "border-line bg-white text-maroon"}`}
          >
            {statusLabel(s)} ({report.households[s]})
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {shown.length === 0 ? (
            <EmptyState title="No RSVPs here yet" />
          ) : (
            <ul className="space-y-3">
              {shown.map((r) => {
                const people = attendees.filter((a) => a.rsvp_id === r.id);
                const flags = [
                  people.some((p) => p.is_child_under_12) && "child under 12",
                  people.some((p) => p.is_senior) && "senior",
                  people.some((p) => p.needs_assistance) && "assistance",
                ].filter(Boolean);
                return (
                  <li key={r.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">{label(r)}</p>
                          <p className="text-xs text-muted">
                            {people.length} {people.length === 1 ? "person" : "people"}
                            {r.source !== "app" ? ` · via ${humanize(r.source)}` : ""}
                            {r.guest_phone_e164 ? ` · ${r.guest_phone_e164}` : ""}
                            {r.commitment_mode && r.commitment_mode !== "none" ? ` · commitment ${humanize(r.commitment_mode)}` : ""}
                            {r.confirmed_at ? ` · confirmed ${formatDateTime(r.confirmed_at, tz)}` : ""}
                          </p>
                          {flags.length > 0 && <p className="mt-1 text-xs font-semibold text-warning">Flags: {flags.join(", ")}</p>}
                        </div>
                        <Badge tone={r.status === "attended" ? "success" : r.status === "confirmed" ? "navy" : r.status === "cancelled" || r.status === "no_show" ? "danger" : "muted"}>
                          {statusLabel(r.status)}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <Details summary="People">
                          <ul className="space-y-1 text-sm">
                            {people.map((p) => {
                              const slot = slots.find((s) => s.id === p.lunch_slot_id);
                              return (
                                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                                  <span>
                                    {p.display_name}
                                    {p.is_child_under_12 ? " · under 12" : ""}
                                    {p.is_senior ? " · senior" : ""}
                                    {p.needs_assistance ? ` · assistance${p.assistance_note ? ` (${p.assistance_note})` : ""}` : ""}
                                  </span>
                                  <span className="text-muted">
                                    {p.checked_in_at ? `in ${formatTime(p.checked_in_at, tz)}` : "not in"}
                                    {slot ? ` · lunch ${formatTime(slot.starts_at, tz)}` : ""}
                                    {p.served_food_at ? " · served" : ""}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </Details>
                      </div>
                      {canEdit && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {r.status !== "confirmed" && r.status !== "attended" && r.status !== "cancelled" && (
                            <ActionButton action={setRsvpStatus.bind(null, event.id, r.id)} fields={{ status: "confirmed" }} label="Confirm" />
                          )}
                          {r.status === "waitlisted" && <ActionButton action={setRsvpStatus.bind(null, event.id, r.id)} fields={{ status: "rsvpd" }} label="Offer a seat" />}
                          {r.status !== "cancelled" && r.status !== "attended" && (
                            <ActionButton
                              action={setRsvpStatus.bind(null, event.id, r.id)}
                              fields={{ status: "cancelled" }}
                              label="Cancel"
                              className="btn btn-danger"
                              confirm={`Cancel the RSVP for ${label(r)}?`}
                            />
                          )}
                          {(r.status === "confirmed" || r.status === "rsvpd") && event.status !== "draft" && (
                            <ActionButton action={setRsvpStatus.bind(null, event.id, r.id)} fields={{ status: "no_show" }} label="No-show" />
                          )}
                          {(r.status === "cancelled" || r.status === "no_show") && (
                            <ActionButton action={setRsvpStatus.bind(null, event.id, r.id)} fields={{ status: "rsvpd" }} label="Reopen" />
                          )}
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {canEdit && (
          <div>
            <Card title="Add a guest RSVP" description="For people without the app — they are added as an admin RSVP.">
              <ActionForm action={addGuestRsvp.bind(null, event.id)} submitLabel="Add RSVP" resetOnSuccess submitClassName="btn btn-maroon">
                <div className="space-y-3">
                  <Field label="Party name">
                    <input name="guest_name" className="field-input" placeholder="e.g. Shah family" />
                  </Field>
                  <FormGrid>
                    <Field label="Mobile">
                      <input name="guest_phone" type="tel" className="field-input" />
                    </Field>
                    <Field label="Email">
                      <input name="guest_email" type="email" className="field-input" />
                    </Field>
                  </FormGrid>
                  <Field label="People" hint='One per line. Add ", child", ", senior" or ", assistance" after a name.'>
                    <textarea name="party" rows={4} required className="field-input" placeholder={"Priya Shah\nAnya Shah, child"} />
                  </Field>
                  <Checkbox name="confirmed" label="Already confirmed" />
                </div>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
