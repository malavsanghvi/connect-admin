import { ActionButton, ActionForm } from "@/components/action-form";
import { PersonPicker } from "@/components/person-picker";
import { Badge, Card, Details, EmptyState, Field, FormGrid, LoadProblem, Notice, Select } from "@/components/ui";
import { can, hasScopedRole } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { resolvePeopleNames } from "@/lib/data/people";
import { formatTime, humanize } from "@/lib/format";
import { getSupabase, load, rows, type Viewer } from "@/lib/session";
import { assignVolunteer, createShift, deleteShift, grantEventRole, setAssignment } from "../actions";

const STATION_ROLE: Record<string, string | undefined> = { entry: "checkin_volunteer", food: "checkin_volunteer", gifts: "checkin_volunteer", kitchen: "kitchen_lead" };

export async function VolunteersTab({ event, viewer }: { event: Tables<"events">; viewer: Viewer }) {
  const supabase = await getSupabase();
  const tz = viewer.center.time_zone;
  const res = await load(async () => {
    const shifts = rows(await supabase.from("volunteer_shifts").select("*").eq("event_id", event.id).order("station").order("starts_at"), "volunteer shifts");
    const assignments = shifts.length
      ? rows(await supabase.from("volunteer_assignments").select("*").in("shift_id", shifts.map((s) => s.id)), "volunteer assignments")
      : [];
    return { shifts, assignments, names: await resolvePeopleNames(supabase, assignments.map((a) => a.person_id)) };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { shifts, assignments, names } = res.data;
  const canEdit = can(viewer.access, "events.manage", "volunteers.manage") || hasScopedRole(viewer.access, event.id, "event_lead");
  const canGrant = can(viewer.access, "roles.manage");
  const stations = [...new Set(shifts.map((s) => s.station))];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {!canGrant && canEdit && (
          <Notice>
            Assigning a volunteer here doesn&apos;t open the check-in screen for them. A center admin grants that access (Check-in volunteer, for this
            event).
          </Notice>
        )}
        {shifts.length === 0 ? (
          <EmptyState title="No shifts yet">{canEdit ? "Add shifts for each station on the right." : ""}</EmptyState>
        ) : (
          stations.map((station) => (
            <Card key={station} title={humanize(station)}>
              <ul className="divide-y divide-line">
                {shifts
                  .filter((s) => s.station === station)
                  .map((s) => {
                    const people = assignments.filter((a) => a.shift_id === s.id && a.status !== "declined");
                    const full = s.capacity !== null && people.length >= s.capacity;
                    return (
                      <li key={s.id} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">
                            {s.starts_at ? formatTime(s.starts_at, tz) : "Any time"}
                            {s.ends_at ? `–${formatTime(s.ends_at, tz)}` : ""}{" "}
                            <span className="text-sm font-normal text-muted">
                              · {people.length}
                              {s.capacity !== null ? ` of ${s.capacity}` : ""} volunteers
                            </span>{" "}
                            {s.capacity !== null && !full && <Badge tone="warning">Needs {s.capacity - people.length}</Badge>}
                          </p>
                          {canEdit && (
                            <ActionButton action={deleteShift.bind(null, event.id, s.id)} label="Remove shift" className="btn btn-danger" confirm="Remove this shift and its assignments?" />
                          )}
                        </div>
                        {s.notes && <p className="text-sm text-muted">{s.notes}</p>}
                        <ul className="mt-2 space-y-2">
                          {assignments
                            .filter((a) => a.shift_id === s.id)
                            .map((a) => (
                              <li key={a.id} className="flex flex-col gap-2 rounded-lg bg-sand p-2 sm:flex-row sm:items-center sm:justify-between">
                                <span>
                                  <span className="font-semibold">{names.get(a.person_id) ?? "Volunteer"}</span>{" "}
                                  <Badge tone={a.status === "confirmed" || a.status === "completed" ? "success" : a.status === "declined" || a.status === "no_show" ? "danger" : "muted"}>
                                    {humanize(a.status)}
                                  </Badge>
                                </span>
                                {canEdit && (
                                  <span className="flex flex-wrap gap-2">
                                    {a.status === "assigned" && <ActionButton action={setAssignment.bind(null, event.id, a.id)} fields={{ status: "confirmed" }} label="Confirmed" />}
                                    {a.status !== "completed" && event.status === "live" && (
                                      <ActionButton action={setAssignment.bind(null, event.id, a.id)} fields={{ status: "no_show" }} label="No-show" />
                                    )}
                                    <ActionButton action={setAssignment.bind(null, event.id, a.id)} fields={{ status: "remove" }} label="Remove" className="btn btn-danger" />
                                    {canGrant && STATION_ROLE[s.station] && (
                                      <ActionButton
                                        action={grantEventRole.bind(null, event.id, a.person_id)}
                                        fields={{ role: STATION_ROLE[s.station]! }}
                                        label={s.station === "kitchen" ? "Give kitchen access" : "Give check-in access"}
                                      />
                                    )}
                                  </span>
                                )}
                              </li>
                            ))}
                        </ul>
                        {canEdit && (
                          <div className="mt-2">
                            <Details summary="Assign volunteers">
                              <ActionForm action={assignVolunteer.bind(null, event.id, s.id)} submitLabel="Assign" resetOnSuccess submitClassName="btn btn-maroon">
                                <PersonPicker name="person_id" label="Volunteers" multiple />
                              </ActionForm>
                            </Details>
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </Card>
          ))
        )}
      </div>
      {canEdit && (
        <Card title="Add a shift">
          <ActionForm action={createShift.bind(null, event.id)} submitLabel="Add shift" resetOnSuccess submitClassName="btn btn-maroon">
            <div className="space-y-3">
              <Field label="Station">
                <Select
                  name="station"
                  defaultValue="entry"
                  options={[
                    { value: "entry", label: "Entry (check-in)" },
                    { value: "food", label: "Food" },
                    { value: "gifts", label: "Gifts" },
                    { value: "kitchen", label: "Kitchen" },
                    { value: "parking", label: "Parking" },
                    { value: "app_seva", label: "App help desk" },
                  ]}
                />
              </Field>
              <FormGrid>
                <Field label="Starts">
                  <input type="datetime-local" name="starts_at" className="field-input" />
                </Field>
                <Field label="Ends">
                  <input type="datetime-local" name="ends_at" className="field-input" />
                </Field>
              </FormGrid>
              <Field label="Volunteers needed">
                <input type="number" name="capacity" min={1} className="field-input" />
              </Field>
              <Field label="Notes">
                <input name="notes" className="field-input" />
              </Field>
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
