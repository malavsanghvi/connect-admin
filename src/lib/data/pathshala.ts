import "server-only";

import type { Tables } from "@/lib/database.types";
import { rows } from "@/lib/session";
import type { ServerSupabase } from "@/lib/supabase/server";

export type Term = Tables<"pathshala_terms">;
export type PClass = Tables<"pathshala_classes">;
export type Level = Tables<"pathshala_levels"> & { track_name: string };

export async function loadTerms(supabase: ServerSupabase, centerId: string): Promise<Term[]> {
  return rows(await supabase.from("pathshala_terms").select("*").eq("center_id", centerId).order("starts_on", { ascending: false }), "Pathshala terms");
}

/** The term to show: the requested one, else active, else open for registration, else the latest. */
export function pickTerm(terms: Term[], requested?: string | null): Term | null {
  if (requested) {
    const t = terms.find((x) => x.id === requested);
    if (t) return t;
  }
  return terms.find((t) => t.status === "active") ?? terms.find((t) => t.status === "registration") ?? terms[0] ?? null;
}

export async function loadLevels(supabase: ServerSupabase, centerId: string): Promise<Level[]> {
  const [tracks, levels] = await Promise.all([
    supabase.from("pathshala_tracks").select("id, name, key").eq("center_id", centerId),
    supabase.from("pathshala_levels").select("*").eq("center_id", centerId).order("sort_order"),
  ]);
  const t = rows(tracks, "Pathshala tracks");
  const trackName = new Map(t.map((x) => [x.id, x.name]));
  const trackOrder = new Map(t.map((x, i) => [x.id, ["jainism", "gujarati", "hindi"].indexOf(x.key) >= 0 ? ["jainism", "gujarati", "hindi"].indexOf(x.key) : 10 + i]));
  return rows(levels, "Pathshala levels")
    .map((l) => ({ ...l, track_name: trackName.get(l.track_id) ?? "Other" }))
    .sort((a, b) => (trackOrder.get(a.track_id) ?? 99) - (trackOrder.get(b.track_id) ?? 99) || a.sort_order - b.sort_order);
}

export async function loadClasses(supabase: ServerSupabase, centerId: string, termId: string): Promise<PClass[]> {
  return rows(
    await supabase.from("pathshala_classes").select("*").eq("center_id", centerId).eq("term_id", termId).order("name"),
    "classes",
  );
}

export async function loadTeachers(supabase: ServerSupabase, classIds: string[]) {
  if (!classIds.length) return [];
  return rows(await supabase.from("pathshala_teachers").select("*").in("class_id", classIds), "teachers");
}

export const ROSTER_STATUSES = ["placed", "active"] as const;

export function levelLabel(levels: Level[], id: string | null | undefined): string {
  if (!id) return "—";
  const l = levels.find((x) => x.id === id);
  return l ? l.name : "—";
}

export function ageFrom(dob: string | null, todayIso: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age;
}
