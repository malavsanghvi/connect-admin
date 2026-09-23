// Who can do what — a faithful mirror of the database helpers in
// connect-crm/supabase/migrations/0001 + 0010:
//   app.has_permission(center, perm)   -> center-wide grants only (scope_kind center|platform)
//   app.has_scoped_role(center, id, …) -> role granted center-wide OR for that scope id
// The UI uses this to decide what to show; RLS still enforces every row.
// Pure module: no server imports, unit-tested.

export type GrantRow = {
  role_key: string;
  scope_kind: string;
  scope_id: string | null;
  starts_at: string;
  ends_at: string | null;
};

export type RoleRow = { key: string; permissions: unknown };

export type Access = {
  isPlatformAdmin: boolean;
  /** Permission strings from center-wide (center/platform scope) grants. */
  perms: string[];
  /** Active grants, kept for scoped-role checks. */
  grants: GrantRow[];
};

export const EVENT_ROLES = ["event_lead", "checkin_volunteer", "boli_recorder", "kitchen_lead"] as const;

function isActive(g: GrantRow, now: Date): boolean {
  const starts = new Date(g.starts_at).getTime();
  if (Number.isFinite(starts) && starts > now.getTime()) return false;
  if (g.ends_at) {
    const ends = new Date(g.ends_at).getTime();
    if (Number.isFinite(ends) && ends <= now.getTime()) return false;
  }
  return true;
}

function permissionList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : [];
}

export function computeAccess(input: {
  grants: GrantRow[];
  roles: RoleRow[];
  isPlatformAdmin: boolean;
  now?: Date;
}): Access {
  const now = input.now ?? new Date();
  const active = input.grants.filter((g) => isActive(g, now));
  const byKey = new Map(input.roles.map((r) => [r.key, permissionList(r.permissions)]));
  const perms = new Set<string>();
  for (const g of active) {
    // Mirrors 0010 has_permission: only center/platform-scope grants confer
    // permissions. (A '*' wildcard is NOT expanded by the database either.)
    if (g.scope_kind !== "center" && g.scope_kind !== "platform") continue;
    for (const p of byKey.get(g.role_key) ?? []) perms.add(p);
  }
  return { isPlatformAdmin: input.isPlatformAdmin, perms: [...perms].sort(), grants: active };
}

export function can(access: Access, ...anyOf: string[]): boolean {
  if (access.isPlatformAdmin) return true;
  return anyOf.some((p) => access.perms.includes(p));
}

/** Mirrors app.has_scoped_role: center-wide grant of the role, or a grant for this scope id. */
export function hasScopedRole(access: Access, scopeId: string, ...roles: string[]): boolean {
  if (access.isPlatformAdmin) return true;
  return access.grants.some(
    (g) => roles.includes(g.role_key) && (g.scope_kind === "center" || g.scope_id === scopeId),
  );
}

/** Holds the role anywhere (any scope). */
export function hasRole(access: Access, ...roles: string[]): boolean {
  if (access.isPlatformAdmin) return true;
  return access.grants.some((g) => roles.includes(g.role_key));
}

/** Holds the role center-wide (so it applies to every class/event/zone). */
export function hasCenterRole(access: Access, ...roles: string[]): boolean {
  if (access.isPlatformAdmin) return true;
  return access.grants.some((g) => roles.includes(g.role_key) && g.scope_kind === "center");
}

/** Scope ids for which the user holds one of the roles through a scoped grant. */
export function scopeIds(access: Access, ...roles: string[]): string[] {
  const ids = new Set<string>();
  for (const g of access.grants) {
    if (roles.includes(g.role_key) && g.scope_id && g.scope_kind !== "center") ids.add(g.scope_id);
  }
  return [...ids];
}

export const teacherClassIds = (a: Access) => scopeIds(a, "teacher");
export const zoneLeadZoneIds = (a: Access) => scopeIds(a, "zone_lead");
export const eventScopedIds = (a: Access, ...roles: string[]) =>
  scopeIds(a, ...(roles.length ? roles : [...EVENT_ROLES]));

// ---------------------------------------------------------------------------
// Area checks used by navigation, pages and Server Actions alike.
// ---------------------------------------------------------------------------
export const areas = {
  pathshalaAdmin: (a: Access) => can(a, "pathshala.view", "pathshala.manage"),
  pathshalaManage: (a: Access) => can(a, "pathshala.manage"),
  teaches: (a: Access) => hasRole(a, "teacher"),
  signoffs: (a: Access) => can(a, "pathshala.teach", "pathshala.manage") || hasRole(a, "teacher"),
  announcements: (a: Access) => can(a, "pathshala.view", "pathshala.manage") || hasRole(a, "teacher"),
  committee: (a: Access) =>
    can(a, "events.view", "events.manage", "governance.view", "pathshala.view", "pathshala.manage"),
  eventsAdmin: (a: Access) => can(a, "events.view", "events.manage"),
  eventsManage: (a: Access) => can(a, "events.manage"),
  events: (a: Access) => can(a, "events.view", "events.manage") || hasRole(a, "event_lead"),
  checkIn: (a: Access, eventId: string) =>
    can(a, "events.manage") || hasScopedRole(a, eventId, "event_lead", "checkin_volunteer"),
  kitchen: (a: Access, eventId: string) =>
    can(a, "events.view", "events.manage", "kitchen.view") || hasScopedRole(a, eventId, "event_lead", "kitchen_lead"),
  ops: (a: Access) => can(a, "events.manage", "kitchen.view") || hasRole(a, "event_lead", "checkin_volunteer", "kitchen_lead"),
  bolis: (a: Access) => can(a, "bolis.view", "bolis.manage", "bolis.record") || hasRole(a, "boli_recorder"),
  store: (a: Access) => can(a, "store.view", "store.manage", "store.pickup"),
  content: (a: Access) => can(a, "content.manage", "content.draft"),
  comms: (a: Access) => can(a, "comms.view", "comms.send", "comms.inbox") || hasRole(a, "zone_lead"),
  volunteers: (a: Access) => can(a, "volunteers.view", "volunteers.manage", "safety.view", "safety.manage"),
};

export const EMPTY_ACCESS: Access = { isPlatformAdmin: false, perms: [], grants: [] };
