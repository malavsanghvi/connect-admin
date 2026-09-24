import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, EmptyState, LoadProblem, Notice, TableWrap, td, th } from "@/components/ui";
import { can, hasScopedRole } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { formatDateTime, formatTime } from "@/lib/format";
import { lunchSlotCounts, UNLIMITED_SEATS } from "@/lib/logic/event-report";
import { getSupabase, load, rows, type Viewer } from "@/lib/session";
import { generateLunchSlots, setSlotStatus, updateSlotSeats } from "../actions";

export async function LunchTab({ event, viewer }: { event: Tables<"events">; viewer: Viewer }) {
  const supabase = await getSupabase();
  const tz = viewer.center.time_zone;
  const res = await load(async () => {
    const [slots, attendees] = await Promise.all([
      supabase.from("lunch_slots").select("*").eq("event_id", event.id).order("starts_at"),
      supabase
        .from("attendees")
        .select("id, rsvp_id, status, checked_in_at, served_food_at, lunch_slot_id, is_child_under_12, is_senior, needs_assistance")
        .eq("event_id", event.id),
    ]);
    return { slots: rows(slots, "lunch slots"), attendees: rows(attendees, "attendees") };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { slots, attendees } = res.data;
  const canRun = can(viewer.access, "events.manage") || hasScopedRole(viewer.access, event.id, "event_lead", "kitchen_lead");
  const counts = lunchSlotCounts(slots, attendees);
  const waiting = attendees.filter((a) => a.checked_in_at && !a.lunch_slot_id).length;

  if (!event.lunch_enabled) {
    return (
      <EmptyState title="Lunch slots are off for this event">
        Turn them on in{" "}
        <Link className="font-semibold text-navy underline" href={`/events/${event.id}?tab=details`}>
          Details
        </Link>{" "}
        and set the lunch start time.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <Notice>
        Lunch starts {formatDateTime(event.lunch_starts_at, tz)} · {event.lunch_slot_minutes}-minute slots ·{" "}
        {event.lunch_seats_per_slot ? `${event.lunch_seats_per_slot} seats each` : "unlimited seats"}. Families with a child under 12 and seniors eat at the
        first slot; everyone else is placed by arrival when they check in.
      </Notice>
      {waiting > 0 && <Notice tone="warning">{waiting} checked-in people have no lunch slot yet (all slots may be full).</Notice>}
      {slots.length === 0 ? (
        <Card>
          <EmptyState title="No slots yet">Slots are created automatically at the first check-in, or you can create them now.</EmptyState>
          {canRun && (
            <div className="mt-3 text-center">
              <ActionButton action={generateLunchSlots.bind(null, event.id)} label="Create slots now" className="btn btn-maroon" />
            </div>
          )}
        </Card>
      ) : (
        <Card title="Slots">
          <TableWrap>
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={th}>Slot</th>
                  <th className={th}>Seats</th>
                  <th className={th}>Assigned</th>
                  <th className={th}>Served</th>
                  <th className={th}>Status</th>
                  {canRun && <th className={th}>Control</th>}
                </tr>
              </thead>
              <tbody>
                {counts.map((s) => (
                  <tr key={s.id} className={s.status === "now_serving" ? "bg-success-soft" : undefined}>
                    <td className={td}>
                      <span className="font-semibold">{formatTime(s.starts_at, tz)}</span>
                    </td>
                    <td className={td}>
                      {canRun ? (
                        <ActionForm action={updateSlotSeats.bind(null, event.id, s.id)} submitLabel="Set" submitClassName="btn btn-secondary min-h-11 px-3" layout="inline" successMessage={null}>
                          <input
                            name="seats"
                            type="number"
                            min={0}
                            defaultValue={s.seats >= UNLIMITED_SEATS ? "" : s.seats}
                            placeholder="∞"
                            aria-label="Seats"
                            className="field-input mr-2 inline-block w-24"
                          />
                        </ActionForm>
                      ) : s.seats >= UNLIMITED_SEATS ? (
                        "Unlimited"
                      ) : (
                        s.seats
                      )}
                    </td>
                    <td className={td}>
                      {s.assignedCount}
                      {s.seats < UNLIMITED_SEATS && <span className="text-muted"> · {s.seatsLeft} left</span>}
                    </td>
                    <td className={td}>{s.servedCount}</td>
                    <td className={td}>
                      <Badge tone={s.status === "now_serving" ? "success" : s.status === "done" ? "muted" : "navy"}>
                        {s.status === "now_serving" ? "Now serving" : s.status === "done" ? "Done" : "Scheduled"}
                      </Badge>
                    </td>
                    {canRun && (
                      <td className={td}>
                        <div className="flex flex-wrap gap-2">
                          {s.status !== "now_serving" && (
                            <ActionButton action={setSlotStatus.bind(null, event.id, s.id)} fields={{ status: "now_serving" }} label="Now serving" className="btn btn-success" />
                          )}
                          {s.status === "now_serving" && <ActionButton action={setSlotStatus.bind(null, event.id, s.id)} fields={{ status: "done" }} label="Done" />}
                          {s.status === "done" && <ActionButton action={setSlotStatus.bind(null, event.id, s.id)} fields={{ status: "scheduled" }} label="Reset" />}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
    </div>
  );
}
