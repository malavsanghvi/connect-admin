import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { computeAccess, type Access } from "@/lib/access";
import { pickOpsEvent, scopedEventIdsForOps } from "@/lib/nav";
import { friendlyError } from "@/lib/result";
import { requireEnv } from "@/lib/env";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export type Center = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  time_zone: string;
};

export type Viewer = {
  userId: string;
  email: string | null;
  displayName: string;
  personId: string | null;
  center: Center;
  access: Access;
  /** Event used for the ops links in the nav (event-scoped volunteers/leads). */
  opsEventId: string | null;
};

export type ViewerResult =
  | { status: "ok"; viewer: Viewer }
  | { status: "signed_out" }
  | { status: "error"; error: string };

export class LoadError extends Error {
  constructor(public readonly friendly: string) {
    super(friendly);
    this.name = "LoadError";
  }
}

/** Per-request Supabase client (memoized for one render pass). */
export const getSupabase = cache(async (): Promise<ServerSupabase> => createClient());

export const getViewer = cache(async (): Promise<ViewerResult> => {
  const env = requireEnv();
  const supabase = await getSupabase();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && userError.name !== "AuthSessionMissingError") {
    console.error("[viewer] getUser failed", userError);
  }
  const user = userData?.user;
  if (!user) return { status: "signed_out" };

  const { data: center, error: centerError } = await supabase
    .from("centers")
    .select("id, slug, name, short_name, time_zone")
    .eq("slug", env.centerSlug)
    .maybeSingle();
  if (centerError) {
    console.error("[viewer] center lookup failed", centerError);
    return { status: "error", error: friendlyError(centerError, "load your community's settings") };
  }
  if (!center) {
    return {
      status: "error",
      error: `No community with the code "${env.centerSlug}" was found. Check NEXT_PUBLIC_CENTER_SLUG.`,
    };
  }

  const [accountRes, cuRes, grantsRes, rolesRes] = await Promise.all([
    supabase.from("accounts").select("is_platform_admin").eq("user_id", user.id).maybeSingle(),
    supabase.from("center_users").select("person_id").eq("center_id", center.id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("role_grants")
      .select("role_key, scope_kind, scope_id, starts_at, ends_at")
      .eq("center_id", center.id)
      .eq("user_id", user.id),
    supabase.from("roles").select("key, permissions"),
  ]);
  for (const [label, res] of [
    ["your account", accountRes],
    ["your membership", cuRes],
    ["your roles", grantsRes],
    ["the role catalog", rolesRes],
  ] as const) {
    if (res.error) {
      console.error(`[viewer] loading ${label} failed`, res.error);
      return { status: "error", error: friendlyError(res.error, `load ${label}`) };
    }
  }

  const access = computeAccess({
    grants: grantsRes.data ?? [],
    roles: rolesRes.data ?? [],
    isPlatformAdmin: accountRes.data?.is_platform_admin ?? false,
  });

  const personId = cuRes.data?.person_id ?? null;
  let displayName = user.email ?? user.phone ?? "Signed in";
  if (personId) {
    const { data: person, error } = await supabase
      .from("people")
      .select("first_name, last_name, preferred_name")
      .eq("id", personId)
      .maybeSingle();
    if (error) console.error("[viewer] loading your name failed (showing email instead)", error);
    if (person) displayName = `${person.preferred_name || person.first_name} ${person.last_name}`;
  }

  let opsEventId: string | null = null;
  const scopedEvents = scopedEventIdsForOps(access);
  if (scopedEvents.length) {
    const { data: evs, error } = await supabase
      .from("events")
      .select("id, starts_at, ends_at, status")
      .in("id", scopedEvents);
    if (error) console.error("[viewer] loading your events failed (ops links hidden)", error);
    opsEventId = pickOpsEvent(evs ?? []);
  }

  return {
    status: "ok",
    viewer: { userId: user.id, email: user.email ?? null, displayName, personId, center, access, opsEventId },
  };
});

/** For pages: signed-out users go to /login; load failures surface through the layout. */
export async function requireViewer(): Promise<Viewer> {
  const res = await getViewer();
  if (res.status === "signed_out") redirect("/login");
  if (res.status === "error") throw new LoadError(res.error);
  return res.viewer;
}

/**
 * For Server Actions: returns the viewer or a plain-English reason.
 * Never redirects (the client expects an ActionResult).
 */
export async function viewerForAction(): Promise<{ ok: true; viewer: Viewer; supabase: ServerSupabase } | { ok: false; error: string }> {
  const res = await getViewer();
  if (res.status === "signed_out") return { ok: false, error: "Your session has ended. Sign in again, then retry." };
  if (res.status === "error") return { ok: false, error: res.error };
  return { ok: true, viewer: res.viewer, supabase: await getSupabase() };
}

type QueryResult = { data: unknown; error: unknown };

/** Unwrap a list query; logs technical detail and throws a friendly LoadError. */
export function rows<R extends QueryResult>(res: R, what: string): NonNullable<R["data"]> {
  if (res.error) {
    console.error(`[load ${what}]`, res.error);
    throw new LoadError(friendlyError(res.error, `load ${what}`));
  }
  return (res.data ?? []) as NonNullable<R["data"]>;
}

/** Unwrap a maybeSingle query. */
export function row<R extends QueryResult>(res: R, what: string): NonNullable<R["data"]> | null {
  if (res.error) {
    console.error(`[load ${what}]`, res.error);
    throw new LoadError(friendlyError(res.error, `load ${what}`));
  }
  return (res.data ?? null) as NonNullable<R["data"]> | null;
}

/** Run a page's loader; turn any failure into a plain-English message for <LoadProblem>. */
export async function load<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof LoadError) return { ok: false, error: error.friendly };
    // redirect()/notFound() throw control-flow errors that must propagate.
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("[load] unexpected failure", error);
    return { ok: false, error: friendlyError(error, "load this page") };
  }
}
