"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { can, hasScopedRole, type Access } from "@/lib/access";
import { actionContext } from "@/lib/action-context";
import type { TablesUpdate } from "@/lib/database.types";
import { all, bool, cents, dateTime, FormError, int, must, oneOf, reqStr, runAction, str } from "@/lib/forms";
import { parseDollarsToCents, toE164 } from "@/lib/format";
import { parsePartyLines, planLunchSlots } from "@/lib/logic/event-report";
import { ok, type ActionResult } from "@/lib/result";

const AUDIENCES = ["members_only", "life_members_only", "pathshala_families", "members_and_guests", "public"] as const;
const EVENT_STATUSES = ["draft", "published", "rsvp_closed", "live", "completed", "cancelled"] as const;
const STATIONS = ["entry", "food", "gifts", "parking", "kitchen", "app_seva"] as const;
const FLAGS = ["child_under_12", "senior", "assistance"] as const;

const canEditEvent = (a: Access, eventId: string) => can(a, "events.manage") || hasScopedRole(a, eventId, "event_lead");

function centsList(fd: FormData, key: string, label: string): number[] {
  const raw = str(fd, key);
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((part) => {
      const c = parseDollarsToCents(part);
      if (c === null || c <= 0) throw new FormError(`${label}: "${part}" is not an amount.`);
      return c;
    });
}

function eventValues(fd: FormData, tz: string) {
  const startsAt = dateTime(fd, "starts_at", "Starts", tz);
  const endsAt = dateTime(fd, "ends_at", "Ends", tz);
  if (startsAt && endsAt && endsAt <= startsAt) throw new FormError("The event must end after it starts.");
  const rsvpOpens = dateTime(fd, "rsvp_opens_at", "RSVP opens", tz);
  const rsvpCloses = dateTime(fd, "rsvp_closes_at", "RSVP closes", tz);
  if (rsvpOpens && rsvpCloses && rsvpCloses <= rsvpOpens) throw new FormError("RSVPs must close after they open.");
  const lunchEnabled = bool(fd, "lunch_enabled");
  const lunchStarts = dateTime(fd, "lunch_starts_at", "Lunch starts", tz);
  if (lunchEnabled && !lunchStarts) throw new FormError("Set when lunch starts, or turn lunch slots off.");
  const isPaid = bool(fd, "is_paid");
  return {
    name: reqStr(fd, "name", "Event name"),
    description: str(fd, "description"),
    flyer_path: str(fd, "flyer_path"),
    venue: str(fd, "venue"),
    starts_at: startsAt,
    ends_at: endsAt,
    program_year: str(fd, "program_year"),
    capacity: int(fd, "capacity", "Capacity", { min: 0 }),
    waitlist_enabled: bool(fd, "waitlist_enabled"),
    audience: oneOf(fd, "audience", AUDIENCES, "Audience", "members_and_guests"),
    rsvp_opens_at: rsvpOpens,
    rsvp_closes_at: rsvpCloses,
    confirmation_hours_before: int(fd, "confirmation_hours_before", "Confirmation reminder", { min: 0, max: 336 }) ?? 24,
    attendee_flags: all(fd, "attendee_flags").filter((f) => (FLAGS as readonly string[]).includes(f)),
    commitment_options: bool(fd, "commitments_enabled")
      ? {
          per_person: centsList(fd, "commit_per_person", "Per-person amounts"),
          lump_sum: centsList(fd, "commit_lump_sum", "Lump-sum amounts"),
          open: bool(fd, "commit_open"),
        }
      : { per_person: [], lump_sum: [], open: false },
    lunch_enabled: lunchEnabled,
    lunch_starts_at: lunchStarts,
    lunch_slot_minutes: int(fd, "lunch_slot_minutes", "Slot length", { min: 5, max: 120 }) ?? 15,
    lunch_seats_per_slot: int(fd, "lunch_seats_per_slot", "Seats per slot", { min: 1 }),
    lunch_priority_rules: {
      family_with_child_under_12_at_start: bool(fd, "prio_child"),
      senior_at_start: bool(fd, "prio_senior"),
    },
    is_paid: isPaid,
    member_price_cents: isPaid ? cents(fd, "member_price", "Member price") : null,
    guest_price_cents: isPaid ? cents(fd, "guest_price", "Guest price") : null,
    owner_person_id: str(fd, "owner_person_id"),
    confidential: bool(fd, "confidential"),
  };
}

export async function createEvent(fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.createEvent", "create the event", async () => {
    const { supabase, centerId, viewer, tz } = await actionContext((a) => can(a, "events.manage"), "Only event managers can create events.");
    const created = must(
      await supabase
        .from("events")
        .insert({ ...eventValues(fd, tz), center_id: centerId, created_by: viewer.userId, status: "draft" })
        .select("id")
        .single(),
      "create the event",
    );
    redirect(`/events/${created!.id}`);
  });
}

export async function updateEvent(eventId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.updateEvent", "save the event", async () => {
    const { supabase, tz } = await actionContext((a) => canEditEvent(a, eventId), "Only event managers and this event's lead can edit it.");
    const res = must(await supabase.from("events").update(eventValues(fd, tz)).eq("id", eventId).select("id"), "save the event");
    if (!res?.length) throw new FormError("You can't edit this event.");
    refresh();
    return ok("Event saved.");
  });
}

export async function setEventStatus(eventId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.setEventStatus", "change the event status", async () => {
    const { supabase } = await actionContext((a) => canEditEvent(a, eventId), "Only event managers and this event's lead can change its status.");
    const status = oneOf(fd, "status", EVENT_STATUSES, "Status");
    const res = must(await supabase.from("events").update({ status }).eq("id", eventId).select("id"), "change the event status");
    if (!res?.length) throw new FormError("You can't change this event.");
    refresh();
    return ok(
      {
        draft: "Back to draft.",
        published: "Published — RSVPs open in the member app.",
        rsvp_closed: "RSVPs closed.",
        live: "Event is live — check-in is open.",
        completed: "Marked completed.",
        cancelled: "Event cancelled.",
      }[status],
    );
  });
}

// ---------------------------------------------------------------------------
// RSVPs
// ---------------------------------------------------------------------------
export async function setRsvpStatus(eventId: string, rsvpId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.setRsvpStatus", "update the RSVP", async () => {
    const { supabase } = await actionContext(
      (a) => can(a, "events.manage") || hasScopedRole(a, eventId, "event_lead", "checkin_volunteer"),
      "Only event staff can change RSVPs.",
    );
    const status = oneOf(fd, "status", ["rsvpd", "confirmed", "cancelled", "waitlisted", "no_show"] as const, "Status");
    const now = new Date().toISOString();
    const patch: TablesUpdate<"rsvps"> = { status };
    if (status === "confirmed") patch.confirmed_at = now;
    if (status === "cancelled") patch.cancelled_at = now;
    const res = must(await supabase.from("rsvps").update(patch).eq("id", rsvpId).eq("event_id", eventId).select("id"), "update the RSVP");
    if (!res?.length) throw new FormError("You can't change this RSVP.");
    // Keep people who haven't arrived in step with their household's RSVP.
    must(
      await supabase.from("attendees").update({ status }).eq("rsvp_id", rsvpId).is("checked_in_at", null),
      "update the people on this RSVP",
    );
    refresh();
    return ok(`RSVP ${status === "rsvpd" ? "reopened" : status.replace("_", "-")}.`);
  });
}

export async function addGuestRsvp(eventId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.addGuestRsvp", "add the RSVP", async () => {
    const { supabase, centerId } = await actionContext((a) => canEditEvent(a, eventId), "Only event managers and this event's lead can add RSVPs.");
    const party = parsePartyLines(reqStr(fd, "party", "People"));
    if (!party.length) throw new FormError("Add at least one person.");
    const phoneRaw = str(fd, "guest_phone");
    const phone = phoneRaw ? toE164(phoneRaw) : null;
    if (phoneRaw && !phone) throw new FormError("Enter the phone number with area code, e.g. (713) 555-0198.");
    const rsvp = must(
      await supabase
        .from("rsvps")
        .insert({
          center_id: centerId,
          event_id: eventId,
          guest_name: str(fd, "guest_name") ?? party[0].name,
          guest_phone_e164: phone,
          guest_email: str(fd, "guest_email"),
          status: bool(fd, "confirmed") ? "confirmed" : "rsvpd",
          confirmed_at: bool(fd, "confirmed") ? new Date().toISOString() : null,
          source: "admin",
        })
        .select("id")
        .single(),
      "add the RSVP",
    );
    must(
      await supabase.from("attendees").insert(
        party.map((p) => ({
          center_id: centerId,
          event_id: eventId,
          rsvp_id: rsvp!.id,
          display_name: p.name,
          is_child_under_12: p.child_under_12,
          is_senior: p.senior,
          needs_assistance: p.assistance,
        })),
      ),
      "add the people on the RSVP",
    );
    refresh();
    return ok(`RSVP added for ${party.length} ${party.length === 1 ? "person" : "people"}.`);
  });
}

// ---------------------------------------------------------------------------
// Volunteers
// ---------------------------------------------------------------------------
const canManageVolunteers = (a: Access, eventId: string) => canEditEvent(a, eventId) || can(a, "volunteers.manage");

export async function createShift(eventId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.createShift", "add the shift", async () => {
    const { supabase, centerId, tz } = await actionContext((a) => canManageVolunteers(a, eventId), "Only this event's lead or the volunteer coordinator can add shifts.");
    const startsAt = dateTime(fd, "starts_at", "Shift start", tz);
    const endsAt = dateTime(fd, "ends_at", "Shift end", tz);
    if (startsAt && endsAt && endsAt <= startsAt) throw new FormError("The shift must end after it starts.");
    must(
      await supabase.from("volunteer_shifts").insert({
        center_id: centerId,
        event_id: eventId,
        station: oneOf(fd, "station", STATIONS, "Station"),
        starts_at: startsAt,
        ends_at: endsAt,
        capacity: int(fd, "capacity", "Volunteers needed", { min: 1 }),
        notes: str(fd, "notes"),
      }),
      "add the shift",
    );
    refresh();
    return ok("Shift added.");
  });
}

export async function deleteShift(eventId: string, shiftId: string, fd: FormData): Promise<ActionResult<unknown>> {
  void fd;
  return runAction("events.deleteShift", "remove the shift", async () => {
    const { supabase } = await actionContext((a) => canManageVolunteers(a, eventId), "Only this event's lead or the volunteer coordinator can remove shifts.");
    const res = must(await supabase.from("volunteer_shifts").delete().eq("id", shiftId).select("id"), "remove the shift");
    if (!res?.length) throw new FormError("You can't remove this shift.");
    refresh();
    return ok("Shift removed.");
  });
}

export async function assignVolunteer(eventId: string, shiftId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.assignVolunteer", "assign the volunteer", async () => {
    const { supabase, centerId } = await actionContext((a) => canManageVolunteers(a, eventId), "Only this event's lead or the volunteer coordinator can assign volunteers.");
    const personIds = all(fd, "person_id");
    if (!personIds.length) throw new FormError("Choose who to assign.");
    must(
      await supabase.from("volunteer_assignments").insert(personIds.map((person_id) => ({ center_id: centerId, shift_id: shiftId, person_id }))),
      "assign the volunteer",
    );
    refresh();
    return ok(personIds.length === 1 ? "Volunteer assigned." : `${personIds.length} volunteers assigned.`);
  });
}

export async function setAssignment(eventId: string, assignmentId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.setAssignment", "update the assignment", async () => {
    const { supabase } = await actionContext((a) => canManageVolunteers(a, eventId), "Only this event's lead or the volunteer coordinator can change assignments.");
    const status = str(fd, "status");
    if (status === "remove") {
      must(await supabase.from("volunteer_assignments").delete().eq("id", assignmentId), "remove the assignment");
      refresh();
      return ok("Removed.");
    }
    const s = oneOf(fd, "status", ["assigned", "confirmed", "declined", "no_show", "completed"] as const, "Status");
    must(await supabase.from("volunteer_assignments").update({ status: s }).eq("id", assignmentId), "update the assignment");
    refresh();
    return ok("Updated.");
  });
}

/** Give an assigned volunteer the event-scoped role (check-in, kitchen…) so the ops screens open for them. */
export async function grantEventRole(eventId: string, personId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.grantEventRole", "grant event access", async () => {
    const { supabase, centerId, viewer } = await actionContext(
      (a) => can(a, "roles.manage"),
      "Only a center admin can grant access. Ask them to give this volunteer the role for this event.",
    );
    const role = oneOf(fd, "role", ["checkin_volunteer", "kitchen_lead", "boli_recorder", "event_lead"] as const, "Role");
    const cu = must(await supabase.from("center_users").select("user_id").eq("center_id", centerId).eq("person_id", personId).maybeSingle(), "find their login");
    if (!cu) throw new FormError("This person hasn't signed in to Connect yet, so there's no login to give access to.");
    const existing = must(
      await supabase.from("role_grants").select("id").eq("center_id", centerId).eq("user_id", cu.user_id).eq("role_key", role).eq("scope_id", eventId).is("ends_at", null),
      "check existing access",
    );
    if (existing?.length) return ok("They already have this access.");
    must(
      await supabase.from("role_grants").insert({
        center_id: centerId,
        user_id: cu.user_id,
        role_key: role,
        scope_kind: "event",
        scope_id: eventId,
        granted_by: viewer.userId,
        reason: "Event volunteer",
      }),
      "grant event access",
    );
    refresh();
    return ok("Access granted for this event.");
  });
}

// ---------------------------------------------------------------------------
// Lunch slots
// ---------------------------------------------------------------------------
const canRunLunch = (a: Access, eventId: string) => can(a, "events.manage") || hasScopedRole(a, eventId, "event_lead", "kitchen_lead");

export async function generateLunchSlots(eventId: string, fd: FormData): Promise<ActionResult<unknown>> {
  void fd;
  return runAction("events.generateLunchSlots", "create the lunch slots", async () => {
    const { supabase, centerId } = await actionContext((a) => canRunLunch(a, eventId), "Only this event's lead or kitchen lead can set up lunch slots.");
    const e = must(
      await supabase.from("events").select("lunch_enabled, lunch_starts_at, ends_at, lunch_slot_minutes, lunch_seats_per_slot").eq("id", eventId).maybeSingle(),
      "load the event",
    );
    if (!e) throw new FormError("That event no longer exists.");
    if (!e.lunch_enabled || !e.lunch_starts_at) throw new FormError("Turn on lunch slots and set the lunch start time in Details first.");
    const existing = must(await supabase.from("lunch_slots").select("id").eq("event_id", eventId).limit(1), "check existing slots");
    if (existing?.length) throw new FormError("Slots already exist for this event.");
    const plan = planLunchSlots({ lunchStartsAt: e.lunch_starts_at, eventEndsAt: e.ends_at, slotMinutes: e.lunch_slot_minutes, seatsPerSlot: e.lunch_seats_per_slot });
    if (!plan.length) throw new FormError("No slots fit between lunch start and the end of the event. Check the times.");
    must(await supabase.from("lunch_slots").insert(plan.map((p) => ({ ...p, center_id: centerId, event_id: eventId }))), "create the lunch slots");
    refresh();
    return ok(`${plan.length} slots created.`);
  });
}

export async function setSlotStatus(eventId: string, slotId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.setSlotStatus", "update the lunch slot", async () => {
    const { supabase } = await actionContext((a) => canRunLunch(a, eventId), "Only this event's lead or kitchen lead can run lunch.");
    const status = oneOf(fd, "status", ["scheduled", "now_serving", "done"] as const, "Status");
    if (status === "now_serving") {
      // One slot is served at a time: the previous one is done.
      must(
        await supabase.from("lunch_slots").update({ status: "done" }).eq("event_id", eventId).eq("status", "now_serving").neq("id", slotId),
        "finish the previous slot",
      );
    }
    const res = must(await supabase.from("lunch_slots").update({ status }).eq("id", slotId).select("id"), "update the lunch slot");
    if (!res?.length) throw new FormError("You can't change this slot.");
    refresh();
    return ok(status === "now_serving" ? "Now serving." : status === "done" ? "Slot done." : "Slot reset.");
  });
}

export async function updateSlotSeats(eventId: string, slotId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("events.updateSlotSeats", "change the seats", async () => {
    const { supabase } = await actionContext((a) => canRunLunch(a, eventId), "Only this event's lead or kitchen lead can change seats.");
    const seats = int(fd, "seats", "Seats", { min: 0 });
    if (seats === null) throw new FormError("Enter the number of seats.");
    must(await supabase.from("lunch_slots").update({ seats }).eq("id", slotId), "change the seats");
    refresh();
    return ok("Seats updated.");
  });
}
