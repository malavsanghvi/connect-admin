// The community's brand mark for the console's header (a port of connect-crm's tenantBranding, which
// this must agree with: the same brand kit file wins, the same fallbacks). Pure: no server imports.

import type { Json } from "@/lib/database.types";

/** "Jain Society of Houston" → "JS"; "priya" → "P"; blank → "?". */
export function initials(name: string | null | undefined, max = 2): string {
  const parts = (name ?? "").trim().split(/[\s\-_.@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = max <= 1 || parts.length === 1 ? [parts[0][0]] : [parts[0][0], parts[parts.length - 1][0]];
  return letters.join("").toUpperCase();
}

export type TenantBranding = {
  /** https URL of the community's mark (preferred) or logo, or null when none is configured. */
  logoUrl: string | null;
  /** Letters for the fallback tile when there is no logo, e.g. "JSH". */
  monogram: string;
  /** Short name for tight spaces, e.g. "JSH". */
  shortName: string;
};

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^https:\/\/[^\s]+$/i.test(v) ? v : null;
}

/** A brand-kit file path (<center_id>/…) in the public `branding` bucket, as a URL under the Supabase URL. */
function brandingFileUrl(value: unknown, storageBase: string | undefined): string | null {
  if (!storageBase || typeof value !== "string") return null;
  const path = value.trim();
  if (!/^[0-9a-f-]{36}\/[^\s]+$/i.test(path) || path.includes("..")) return null;
  const base = storageBase.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) return null;
  return `${base}/storage/v1/object/public/branding/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * The community's branding from centers.branding (never hard-coded). An uploaded brand kit wins (CRM ›
 * Setup › Profile › Brand kit: branding.mark_path, then branding.logo_path, served from the public
 * `branding` bucket under `storageBase`, the Supabase URL). Otherwise branding.mark_url, then
 * branding.logo_url (https only). A community with no logo gets its initials.
 */
export function tenantBranding(center: { name: string; short_name: string | null; slug: string; branding?: Json | null }, storageBase?: string): TenantBranding {
  const raw = center.branding;
  const b = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, Json | undefined>;
  const logoUrl = brandingFileUrl(b.mark_path, storageBase) ?? brandingFileUrl(b.logo_path, storageBase) ?? httpsUrl(b.mark_url) ?? httpsUrl(b.logo_url);
  const shortName = (center.short_name ?? "").trim() || center.slug.toUpperCase();
  const monogram = /^[A-Za-z0-9]{1,4}$/.test(shortName) ? shortName.toUpperCase() : initials(center.name);
  return { logoUrl, monogram, shortName };
}
