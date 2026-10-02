// Public configuration. Only NEXT_PUBLIC_* values: the anon key is safe to
// ship, and service-role keys never belong in this app (RLS does the work).

export const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  centerSlug: string;
};

// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them in
// client bundles; do not replace these with a dynamic process.env[name] lookup.
function raw() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_CENTER_SLUG: process.env.NEXT_PUBLIC_CENTER_SLUG,
  };
}

export function missingEnv(): string[] {
  const values = raw();
  return REQUIRED_ENV.filter((name) => !values[name] || values[name]!.trim() === "");
}

export function readEnv(): PublicEnv | null {
  const values = raw();
  if (missingEnv().length > 0) return null;
  return {
    supabaseUrl: values.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    supabaseAnonKey: values.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    centerSlug: (values.NEXT_PUBLIC_CENTER_SLUG ?? "").trim() || "jsh",
  };
}

export class MissingEnvError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing environment variables: ${missing.join(", ")}`);
    this.name = "MissingEnvError";
  }
}

export function requireEnv(): PublicEnv {
  const env = readEnv();
  if (!env) throw new MissingEnvError(missingEnv());
  return env;
}

/**
 * An http(s) base URL — scheme, host and an optional path, no query or fragment — trimmed and
 * without trailing slashes, or null when the value is anything else.
 */
export function httpBaseUrl(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/i.test(v)) return null;
  try {
    const url = new URL(v);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname ? v : null;
  } catch {
    return null;
  }
}

/**
 * The Community Connect portal (connect-crm) this console links to — for example its flyer maker.
 * Optional (not in REQUIRED_ENV): without it the console names the portal page in plain text.
 * Set at build time from the repository variable PORTAL_PUBLIC_URL (.github/workflows/deploy.yml).
 */
export function portalUrl(): string | null {
  // Referenced literally so Next.js inlines it at build time (see raw()).
  return httpBaseUrl(process.env.NEXT_PUBLIC_PORTAL_URL);
}
