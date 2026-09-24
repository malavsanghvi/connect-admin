import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";

export type PersonOption = { id: string; name: string; detail: string | null };

function fullName(p: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${p.preferred_name || p.first_name} ${p.last_name}`.trim();
}

/**
 * Names for person ids. Reads `people` (RLS decides which rows come back),
 * then falls back to the opt-in `directory` view for the rest.
 * Missing names come back as undefined; callers show a neutral label.
 */
export async function resolvePeopleNames(supabase: ServerSupabase, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (!unique.length) return names;
  const { data, error } = await supabase.from("people").select("id, first_name, last_name, preferred_name").in("id", unique);
  if (error) console.error("[people] name lookup failed; falling back to directory", error);
  for (const p of data ?? []) names.set(p.id, fullName(p));
  const rest = unique.filter((id) => !names.has(id));
  if (rest.length) {
    const { data: dir, error: dirError } = await supabase.from("directory").select("person_id, name").in("person_id", rest);
    if (dirError) console.error("[people] directory lookup failed", dirError);
    for (const d of dir ?? []) if (d.person_id && d.name) names.set(d.person_id, d.name);
  }
  return names;
}

/** Names for auth user ids (comment authors, voters, approvers). Needs people.view to see others. */
export async function resolveUserNames(
  supabase: ServerSupabase,
  centerId: string,
  userIds: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, string>();
  if (!unique.length) return out;
  const { data, error } = await supabase.from("center_users").select("user_id, person_id").eq("center_id", centerId).in("user_id", unique);
  if (error) {
    console.error("[people] user->person lookup failed", error);
    return out;
  }
  const people = await resolvePeopleNames(supabase, (data ?? []).map((r) => r.person_id));
  for (const r of data ?? []) {
    const n = people.get(r.person_id);
    if (n) out.set(r.user_id, n);
  }
  return out;
}

/** Search people by name, email or phone (RLS-limited) plus the member directory. */
export async function searchPeople(supabase: ServerSupabase, centerId: string, query: string): Promise<{ people: PersonOption[]; error: string | null }> {
  const q = query.trim();
  if (q.length < 2) return { people: [], error: null };
  const safe = q.replace(/[%,()*]/g, " ").trim();
  const parts = safe.split(/\s+/).filter(Boolean);
  let builder = supabase
    .from("people")
    .select("id, first_name, last_name, preferred_name, email, member_number")
    .eq("center_id", centerId)
    .is("merged_into_id", null)
    .limit(20);
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 7) {
    builder = builder.like("phone_e164", `%${digits.slice(-10)}`);
  } else if (safe.includes("@")) {
    builder = builder.ilike("email", `%${safe}%`);
  } else if (parts.length >= 2) {
    builder = builder.ilike("first_name", `${parts[0]}%`).ilike("last_name", `${parts.slice(1).join(" ")}%`);
  } else {
    builder = builder.or(`first_name.ilike.${safe}%,last_name.ilike.${safe}%,preferred_name.ilike.${safe}%,member_number.ilike.${safe}%`);
  }
  const { data, error } = await builder;
  if (error) {
    console.error("[people] search failed", error);
    return { people: [], error: "The people search failed. Try again in a moment." };
  }
  const found: PersonOption[] = (data ?? []).map((p) => ({
    id: p.id,
    name: fullName(p),
    detail: [p.member_number, p.email].filter(Boolean).join(" · ") || null,
  }));
  if (found.length < 20 && digits.length < 7) {
    const { data: dir, error: dirError } = await supabase
      .from("directory")
      .select("person_id, name, zone")
      .eq("center_id", centerId)
      .ilike("name", `%${safe}%`)
      .limit(20);
    if (dirError) console.error("[people] directory search failed", dirError);
    for (const d of dir ?? []) {
      if (d.person_id && d.name && !found.some((f) => f.id === d.person_id)) {
        found.push({ id: d.person_id, name: d.name, detail: d.zone ? `${d.zone} zone` : "Member directory" });
      }
    }
  }
  return { people: found.slice(0, 20), error: null };
}
