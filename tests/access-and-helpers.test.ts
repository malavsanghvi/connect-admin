import { describe, expect, it } from "vitest";
import { areas, can, computeAccess, hasScopedRole, teacherClassIds } from "@/lib/access";
import { buildAudience, describeAudience, requiresSecondApprover } from "@/lib/logic/audience";
import { eventReport, lunchSlotCounts } from "@/lib/logic/event-report";
import { extractTicketToken, randomToken, secondsLeft, tokenExpiry } from "@/lib/logic/tokens";
import { friendlyError } from "@/lib/result";
import { fromDateTimeLocal, parseDollarsToCents, toDateTimeLocal, toE164 } from "@/lib/format";
import { landingPath, pickOpsEvent } from "@/lib/nav";

const roles = [
  { key: "pathshala_principal", permissions: ["pathshala.view", "pathshala.manage", "pathshala.teach"] },
  { key: "teacher", permissions: ["pathshala.teach"] },
  { key: "checkin_volunteer", permissions: [] },
  { key: "platform_owner", permissions: ["*"] },
];
const grant = (role_key: string, scope_kind = "center", scope_id: string | null = null, ends_at: string | null = null) => ({
  role_key,
  scope_kind,
  scope_id,
  starts_at: "2026-01-01T00:00:00Z",
  ends_at,
});
const now = new Date("2026-09-23T12:00:00Z");

describe("access", () => {
  it("grants permissions only from center-wide grants, like app.has_permission", () => {
    const a = computeAccess({ grants: [grant("teacher", "class", "c1")], roles, isPlatformAdmin: false, now });
    expect(can(a, "pathshala.teach")).toBe(false);
    expect(hasScopedRole(a, "c1", "teacher")).toBe(true);
    expect(hasScopedRole(a, "c2", "teacher")).toBe(false);
    expect(teacherClassIds(a)).toEqual(["c1"]);
    expect(areas.teaches(a)).toBe(true);
    expect(areas.pathshalaAdmin(a)).toBe(false);
  });

  it("ignores expired grants and does not expand '*'", () => {
    const a = computeAccess({
      grants: [grant("pathshala_principal", "center", null, "2026-06-01T00:00:00Z"), grant("platform_owner")],
      roles,
      isPlatformAdmin: false,
      now,
    });
    expect(can(a, "pathshala.manage")).toBe(false);
  });

  it("platform admins can do everything", () => {
    const a = computeAccess({ grants: [], roles, isPlatformAdmin: true, now });
    expect(can(a, "anything")).toBe(true);
    expect(hasScopedRole(a, "x", "teacher")).toBe(true);
  });

  it("lands teachers on My classes and check-in volunteers on their scanner", () => {
    const teacher = computeAccess({ grants: [grant("teacher", "class", "c1")], roles, isPlatformAdmin: false, now });
    expect(landingPath(teacher)).toBe("/pathshala/my-classes");
    const vol = computeAccess({ grants: [grant("checkin_volunteer", "event", "e9")], roles, isPlatformAdmin: false, now });
    expect(landingPath(vol, { checkinEventId: "e9" })).toBe("/ops/e9/checkin");
    const principal = computeAccess({ grants: [grant("pathshala_principal")], roles, isPlatformAdmin: false, now });
    expect(landingPath(principal)).toBe("/pathshala");
    const nobody = computeAccess({ grants: [], roles, isPlatformAdmin: false, now });
    expect(landingPath(nobody)).toBe("/no-access");
  });

  it("picks the live, then today's, then next event for ops", () => {
    const evs = [
      { id: "past", starts_at: "2026-09-01T15:00:00Z", ends_at: null, status: "completed" },
      { id: "next", starts_at: "2026-10-01T15:00:00Z", ends_at: null, status: "published" },
    ];
    expect(pickOpsEvent(evs, now)).toBe("next");
    expect(pickOpsEvent([...evs, { id: "live", starts_at: null, ends_at: null, status: "live" }], now)).toBe("live");
    expect(pickOpsEvent([], now)).toBeNull();
  });
});

describe("audience builder", () => {
  it("builds presets and requires a second approver for all members", () => {
    const all = buildAudience("all_members", {});
    expect(all.ok && requiresSecondApprover(all.audience)).toBe(true);
    const zone = buildAudience("zone", { zoneIds: ["z1"] });
    expect(zone.ok && requiresSecondApprover(zone.audience)).toBe(false);
    expect(buildAudience("zone", {}).ok).toBe(false);
    expect(buildAudience("custom", { customJson: "[1]" }).ok).toBe(false);
    const ev = buildAudience("event_rsvps", { eventId: "e1" });
    expect(ev.ok && describeAudience(ev.audience, { events: new Map([["e1", "Diwali"]]) })).toBe("RSVPs for Diwali");
  });
});

describe("event report", () => {
  it("separates RSVP'd, confirmed, checked-in, served, no-shows and walk-ins", () => {
    const rsvps = [
      { id: "r1", status: "attended", source: "app", confirmed_at: "x" },
      { id: "r2", status: "rsvpd", source: "app", confirmed_at: null },
      { id: "r3", status: "attended", source: "walk_in", confirmed_at: null },
      { id: "r4", status: "cancelled", source: "app", confirmed_at: null },
    ];
    const a = (id: string, rsvp_id: string, over: Record<string, unknown> = {}) => ({
      id, rsvp_id, status: "rsvpd", checked_in_at: null, served_food_at: null, lunch_slot_id: null,
      is_child_under_12: false, is_senior: false, needs_assistance: false, ...over,
    });
    const attendees = [
      a("a1", "r1", { checked_in_at: "t", served_food_at: "t", lunch_slot_id: "s1", is_child_under_12: true }),
      a("a2", "r1", { checked_in_at: "t", lunch_slot_id: "s1" }),
      a("a3", "r2", { is_senior: true }),
      a("a4", "r3", { checked_in_at: "t", lunch_slot_id: "s2" }),
      a("a5", "r4", { is_senior: true }),
    ];
    const r = eventReport(rsvps, attendees);
    expect(r).toMatchObject({ rsvpdPeople: 3, confirmedPeople: 2, checkedIn: 3, served: 1, noShows: 1, walkIns: 1, walkInHouseholds: 1 });
    expect(r.flags).toEqual({ childUnder12: 1, senior: 1, assistance: 0 });
    const slots = lunchSlotCounts(
      [
        { id: "s2", starts_at: "2026-09-20T17:15:00Z", seats: 10, status: "scheduled" },
        { id: "s1", starts_at: "2026-09-20T17:00:00Z", seats: 2, status: "now_serving" },
      ],
      attendees,
    );
    expect(slots.map((s) => [s.id, s.assignedCount, s.servedCount, s.seatsLeft])).toEqual([
      ["s1", 2, 1, 0],
      ["s2", 1, 0, 9],
    ]);
  });
});

describe("tokens and formatting", () => {
  it("makes hex tokens and 10-minute expiries", () => {
    expect(randomToken()).toMatch(/^[0-9a-f]{32}$/);
    const exp = tokenExpiry(new Date("2026-09-20T15:00:00Z"));
    expect(exp).toBe("2026-09-20T15:10:00.000Z");
    expect(secondsLeft(exp, new Date("2026-09-20T15:09:00Z"))).toBe(60);
  });

  it("extracts ticket tokens from scanner text", () => {
    const tok = "0123456789abcdef0123456789abcdef";
    expect(extractTicketToken(tok)).toBe(tok);
    expect(extractTicketToken(`https://jsh.example/t?t=${tok}`)).toBe(tok);
    expect(extractTicketToken(`connect:ticket?token=${tok}`)).toBe(tok);
    expect(extractTicketToken("  MANUAL-1  ")).toBe("MANUAL-1");
  });

  it("parses dollars to integer cents", () => {
    expect(parseDollarsToCents("12.5")).toBe(1250);
    expect(parseDollarsToCents("$1,001")).toBe(100100);
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
  });

  it("round-trips center-local datetimes", () => {
    const iso = fromDateTimeLocal("2026-11-08T11:30", "America/Chicago");
    expect(iso).toBe("2026-11-08T17:30:00.000Z"); // CST (UTC-6) after DST ends
    expect(toDateTimeLocal(iso, "America/Chicago")).toBe("2026-11-08T11:30");
    expect(fromDateTimeLocal("2026-09-20T10:00", "America/Chicago")).toBe("2026-09-20T15:00:00.000Z"); // CDT
  });

  it("normalizes phone numbers", () => {
    expect(toE164("(713) 555-0198")).toBe("+17135550198");
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(toE164("555")).toBeNull();
  });

  it("explains database errors in plain English", () => {
    expect(friendlyError({ code: "42501", message: "new row violates row-level security policy" }, "save the class")).toBe(
      "You don't have permission to save the class. Ask the office if you think you should.",
    );
    expect(friendlyError({ code: "23505", message: "duplicate key" }, "add the term")).toMatch(/already exists/);
    expect(friendlyError(new TypeError("Failed to fetch"), "save")).toMatch(/can't be reached/);
    expect(friendlyError({ message: "this boli is not open for pledges" }, "record the pledge")).toBe(
      "Could not record the pledge: this boli is not open for pledges.",
    );
  });
});

describe("two-person rule errors", () => {
  it("passes the database's own reason through", () => {
    expect(friendlyError({ code: "23514", message: "a send to all members needs two different approvers" }, "schedule the send")).toBe(
      "Could not schedule the send: a send to all members needs two different approvers.",
    );
    expect(friendlyError({ code: "23514", message: 'new row for relation "x" violates check constraint "y"' }, "save")).toMatch(/isn't allowed/);
  });
});

describe("lunch slots and party lines", () => {
  it("plans slots like app.ensure_lunch_slots", async () => {
    const { planLunchSlots, UNLIMITED_SEATS } = await import("@/lib/logic/event-report");
    const slots = planLunchSlots({ lunchStartsAt: "2026-11-08T18:00:00Z", eventEndsAt: "2026-11-08T19:00:00Z", slotMinutes: 20, seatsPerSlot: 120 });
    expect(slots.map((s) => s.starts_at)).toEqual(["2026-11-08T18:00:00.000Z", "2026-11-08T18:20:00.000Z", "2026-11-08T18:40:00.000Z"]);
    expect(slots[0].seats).toBe(120);
    const open = planLunchSlots({ lunchStartsAt: "2026-11-08T18:00:00Z", eventEndsAt: null, slotMinutes: 30, seatsPerSlot: null });
    expect(open).toHaveLength(4); // two hours when the event has no end
    expect(open[0].seats).toBe(UNLIMITED_SEATS);
  });

  it("parses party lines with flags", async () => {
    const { parsePartyLines } = await import("@/lib/logic/event-report");
    expect(parsePartyLines("Priya Shah\nAnya Shah, child\n\nKanta Shah, senior, wheelchair")).toEqual([
      { name: "Priya Shah", child_under_12: false, senior: false, assistance: false },
      { name: "Anya Shah", child_under_12: true, senior: false, assistance: false },
      { name: "Kanta Shah", child_under_12: false, senior: true, assistance: true },
    ]);
  });
});
