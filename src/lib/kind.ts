// The organization's kind as data, so wording follows the community instead of one tradition. A small port of the parts of
// connect-crm's src/lib/kind.ts this app needs (which this must agree with): the answer of app.category_profile(center), the
// kind's own names for modules and its wording terms. Pure: no server imports.

import type { Json } from "@/lib/database.types";

export type ModuleAvailability = "default_on" | "default_off" | "not_available";
export type KindModule = { availability: ModuleAvailability; label: string | null };

export type KindProfile = {
  key: string;
  /** "Jain Center", "Chamber of commerce" ... */
  label: string;
  /** The kind's named words (school, learning, store ...). A term may be null: the kind has no such thing. */
  terms: Record<string, string | null>;
  /** The kind's rows per module key: its own name for the module, and whether it is offered at all. */
  modules: Record<string, KindModule>;
};

/**
 * What the app shows when the database cannot say which kind an organization is: the neutral kind (the portal's
 * "Community organization"), with none of a tradition's words and none of the modules only a faith kind has. A failed lookup
 * must never make an organization look like one tradition. This is only wording: the database still enforces what is on.
 */
export const NEUTRAL_KIND: KindProfile = {
  key: "nonprofit_secular",
  label: "Community organization",
  terms: {},
  modules: {
    bolis: { availability: "not_available", label: null },
    pathshala: { availability: "not_available", label: null },
    gyan_path: { availability: "not_available", label: null },
  },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

const AVAILABILITIES: readonly string[] = ["default_on", "default_off", "not_available"];

/** Reads app.category_profile(center)'s answer; null when it is not the shape the contract promises. */
export function parseKindProfile(raw: Json | null | undefined): KindProfile | null {
  if (!isRecord(raw)) return null;
  const cat = raw.category;
  if (!isRecord(cat)) return null;
  const key = str(cat.key);
  const label = str(cat.label);
  if (!key || !label) return null;
  const terms: Record<string, string | null> = {};
  if (isRecord(cat.terms)) {
    for (const [k, v] of Object.entries(cat.terms)) {
      if (typeof v === "string") terms[k] = v;
      else if (v === null) terms[k] = null;
    }
  }
  const modules: Record<string, KindModule> = {};
  if (isRecord(raw.modules)) {
    for (const [k, v] of Object.entries(raw.modules)) {
      if (!isRecord(v)) continue;
      const availability = typeof v.availability === "string" && AVAILABILITIES.includes(v.availability) ? (v.availability as ModuleAvailability) : "default_on";
      modules[k] = { availability, label: str(v.label) };
    }
  }
  return { key, label, terms, modules };
}

export type LoadedKind = { kind: KindProfile; status: "ok" | "error" };

/** The result of the category_profile call, with the neutral kind when it failed or answered with something unreadable. */
export function kindFromProfileResult(res: { data: Json | null; error: unknown }): LoadedKind {
  if (res.error) return { kind: NEUTRAL_KIND, status: "error" };
  const parsed = parseKindProfile(res.data);
  return parsed ? { kind: parsed, status: "ok" } : { kind: NEUTRAL_KIND, status: "error" };
}

/** The kind's word for something (`school`, `learning`, `store` ...), or `fallback` when the kind has none. */
export function kindTerm(kind: Pick<KindProfile, "terms">, key: string, fallback = ""): string {
  const v = kind.terms[key];
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

/** True when the kind never offers the module. A module the kind has no row for counts as offered ("no row means on"). */
export function moduleNotOffered(kind: Pick<KindProfile, "modules">, moduleKey: string): boolean {
  return kind.modules[moduleKey]?.availability === "not_available";
}

const MODULE_TERM: Readonly<Record<string, string>> = { store: "store", pathshala: "school", gyan_path: "learning" };

/** A module's name in this kind: the kind's own name for it, else its term for it, else `fallback`. */
export function kindName(kind: Pick<KindProfile, "modules" | "terms">, moduleKey: string, fallback: string): string {
  const own = kind.modules[moduleKey]?.label;
  if (own) return own;
  const term = MODULE_TERM[moduleKey];
  return term ? kindTerm(kind, term, fallback) : fallback;
}
