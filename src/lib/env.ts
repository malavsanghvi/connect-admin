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
