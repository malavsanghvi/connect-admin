// Event day numbers: RSVP'd vs confirmed vs checked in vs served, no-shows,
// walk-ins, attendee flags, per-slot lunch counts.

export type RsvpLike = { id: string; status: string; source: string; confirmed_at: string | null };
export type AttendeeLike = {
  id: string;
  rsvp_id: string;
  status: string;
  checked_in_at: string | null;
  served_food_at: string | null;
  gift_given_at?: string | null;
  lunch_slot_id: string | null;
  is_child_under_12: boolean;
  is_senior: boolean;
  needs_assistance: boolean;
};

export type EventReport = {
  households: Record<string, number>;
  householdsTotal: number;
  rsvpdPeople: number;
  confirmedPeople: number;
  checkedIn: number;
  served: number;
  giftsGiven: number;
  noShows: number;
  walkIns: number;
  walkInHouseholds: number;
  flags: { childUnder12: number; senior: number; assistance: number };
};

export function eventReport(rsvps: RsvpLike[], attendees: AttendeeLike[]): EventReport {
  const byId = new Map(rsvps.map((r) => [r.id, r]));
  const households: Record<string, number> = {};
  for (const r of rsvps) households[r.status] = (households[r.status] ?? 0) + 1;

  let rsvpdPeople = 0;
  let confirmedPeople = 0;
  let checkedIn = 0;
  let served = 0;
  let giftsGiven = 0;
  let noShows = 0;
  let walkIns = 0;
  const flags = { childUnder12: 0, senior: 0, assistance: 0 };

  for (const a of attendees) {
    const r = byId.get(a.rsvp_id);
    const cancelled = r?.status === "cancelled" || a.status === "cancelled";
    const walkIn = r?.source === "walk_in";
    if (a.checked_in_at) checkedIn += 1;
    if (a.served_food_at) served += 1;
    if (a.gift_given_at) giftsGiven += 1;
    if (cancelled) continue;
    if (a.is_child_under_12) flags.childUnder12 += 1;
    if (a.is_senior) flags.senior += 1;
    if (a.needs_assistance) flags.assistance += 1;
    if (walkIn) {
      walkIns += 1;
      continue;
    }
    rsvpdPeople += 1;
    const confirmed = Boolean(r?.confirmed_at) || r?.status === "confirmed" || r?.status === "attended";
    if (confirmed) confirmedPeople += 1;
    if (!a.checked_in_at) noShows += 1;
  }

  return {
    households,
    householdsTotal: rsvps.length,
    rsvpdPeople,
    confirmedPeople,
    checkedIn,
    served,
    giftsGiven,
    noShows,
    walkIns,
    walkInHouseholds: rsvps.filter((r) => r.source === "walk_in").length,
    flags,
  };
}

export type SlotLike = { id: string; starts_at: string; seats: number; status: string };

export function lunchSlotCounts(slots: SlotLike[], attendees: AttendeeLike[]) {
  return [...slots]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((s) => {
      const inSlot = attendees.filter((a) => a.lunch_slot_id === s.id);
      return {
        ...s,
        assignedCount: inSlot.length,
        servedCount: inSlot.filter((a) => a.served_food_at).length,
        seatsLeft: Math.max(0, s.seats - inSlot.length),
      };
    });
}

/** Unlimited seat sentinel used by app.ensure_lunch_slots when no seats-per-slot is set. */
export const UNLIMITED_SEATS = 1_000_000;

/**
 * Lunch slots for an event, mirroring app.ensure_lunch_slots (which the app
 * may not call directly): from lunch start until the event ends (or two
 * hours), one slot per `slotMinutes`, `seats` each (unlimited when unset).
 */
export function planLunchSlots(input: {
  lunchStartsAt: string;
  eventEndsAt: string | null;
  slotMinutes: number;
  seatsPerSlot: number | null;
}): { starts_at: string; ends_at: string; seats: number }[] {
  const minutes = Math.max(1, Math.floor(input.slotMinutes));
  const start = Date.parse(input.lunchStartsAt);
  if (!Number.isFinite(start)) return [];
  const endCandidate = input.eventEndsAt ? Date.parse(input.eventEndsAt) : NaN;
  const end = Number.isFinite(endCandidate) ? endCandidate : start + 2 * 60 * 60_000;
  const out: { starts_at: string; ends_at: string; seats: number }[] = [];
  for (let t = start; t < end && out.length < 200; t += minutes * 60_000) {
    out.push({
      starts_at: new Date(t).toISOString(),
      ends_at: new Date(t + minutes * 60_000).toISOString(),
      seats: input.seatsPerSlot ?? UNLIMITED_SEATS,
    });
  }
  return out;
}

export type PartyMember = { name: string; child_under_12: boolean; senior: boolean; assistance: boolean };

/**
 * One person per line; optional flags after a comma:
 *   "Anya Shah, child"   "Kantaben Shah, senior, assistance"
 */
export function parsePartyLines(text: string): PartyMember[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(",").map((s) => s.trim());
      const flags = rest.join(" ").toLowerCase();
      return {
        name,
        child_under_12: /\b(child|kid|under ?12)\b/.test(flags),
        senior: /\bsenior\b/.test(flags),
        assistance: /\b(assist|assistance|wheelchair)\b/.test(flags),
      };
    })
    .filter((p) => p.name.length > 0);
}
