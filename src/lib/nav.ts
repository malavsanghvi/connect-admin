import { areas, can, eventScopedIds, hasRole, type Access } from "@/lib/access";

export type NavItem = { href: string; label: string };
export type NavSection = { key: string; label: string; accent: "pathshala" | "events" | "navy"; items: NavItem[] };

// Navigation shows only what the user can use. Pages re-check, RLS enforces.
export function buildNav(access: Access, opts: { opsEventId?: string | null } = {}): NavSection[] {
  const sections: NavSection[] = [];

  const pathshala: NavItem[] = [];
  if (areas.pathshalaAdmin(access)) pathshala.push({ href: "/pathshala", label: "Overview" });
  if (areas.teaches(access)) pathshala.push({ href: "/pathshala/my-classes", label: "My classes" });
  if (areas.pathshalaAdmin(access)) {
    pathshala.push({ href: "/pathshala/classes", label: "Classes" });
    pathshala.push({ href: "/pathshala/enrollments", label: "Enrollments" });
    pathshala.push({ href: "/pathshala/terms", label: "Terms" });
  }
  if (areas.signoffs(access)) pathshala.push({ href: "/pathshala/signoffs", label: "Gyan Path sign-offs" });
  if (areas.announcements(access)) pathshala.push({ href: "/pathshala/announcements", label: "Announcements" });
  if (areas.committee(access)) pathshala.push({ href: "/pathshala/committee", label: "Committee" });
  if (pathshala.length) sections.push({ key: "pathshala", label: "Pathshala", accent: "pathshala", items: pathshala });

  const events: NavItem[] = [];
  if (areas.events(access)) events.push({ href: "/events", label: "Events" });
  if (opts.opsEventId) {
    if (areas.checkIn(access, opts.opsEventId))
      events.push({ href: `/ops/${opts.opsEventId}/checkin`, label: "Check-in" });
    if (areas.kitchen(access, opts.opsEventId))
      events.push({ href: `/ops/${opts.opsEventId}/kitchen`, label: "Kitchen display" });
  }
  if (areas.bolis(access)) events.push({ href: "/bolis", label: "Bolis" });
  if (events.length) sections.push({ key: "events", label: "Events", accent: "events", items: events });

  const more: NavItem[] = [];
  if (areas.store(access)) more.push({ href: "/store", label: "Satvik Store" });
  if (areas.content(access)) more.push({ href: "/content", label: "Content" });
  if (areas.comms(access)) more.push({ href: "/comms", label: "Communications" });
  if (areas.volunteers(access)) more.push({ href: "/volunteers", label: "Volunteers" });
  if (more.length) sections.push({ key: "more", label: "Community", accent: "navy", items: more });

  return sections;
}

// Where a user lands after signing in. Teachers go straight to their classes
// and check-in volunteers to their event's scanner.
export function landingPath(access: Access, opts: { checkinEventId?: string | null } = {}): string {
  if (areas.pathshalaAdmin(access)) return "/pathshala";
  if (areas.teaches(access)) return "/pathshala/my-classes";
  const isScopedVolunteer =
    hasRole(access, "checkin_volunteer") && !can(access, "events.view", "events.manage");
  if (isScopedVolunteer && opts.checkinEventId) return `/ops/${opts.checkinEventId}/checkin`;
  const first = buildNav(access)[0]?.items[0]?.href;
  if (first) return first;
  if (opts.checkinEventId) return `/ops/${opts.checkinEventId}/checkin`;
  return "/no-access";
}

/** Pick the event a scoped volunteer most likely means: live today, else the next upcoming, else the latest. */
export function pickOpsEvent(
  events: { id: string; starts_at: string | null; ends_at: string | null; status: string }[],
  now: Date = new Date(),
): string | null {
  if (!events.length) return null;
  const t = now.getTime();
  const live = events.find((e) => e.status === "live");
  if (live) return live.id;
  const dated = events
    .filter((e) => e.starts_at)
    .map((e) => ({ id: e.id, start: new Date(e.starts_at!).getTime(), end: e.ends_at ? new Date(e.ends_at).getTime() : null }));
  const today = dated.find((e) => sameLocalDay(new Date(e.start), now) || (e.start <= t && e.end !== null && e.end >= t));
  if (today) return today.id;
  const upcoming = dated.filter((e) => e.start >= t).sort((a, b) => a.start - b.start)[0];
  if (upcoming) return upcoming.id;
  const latest = dated.sort((a, b) => b.start - a.start)[0];
  return latest?.id ?? events[0].id;
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function scopedEventIdsForOps(access: Access): string[] {
  return eventScopedIds(access, "event_lead", "checkin_volunteer", "kitchen_lead");
}
