import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { requireEnv } from "@/lib/env";

// One client per request (never shared). Reads use the caller's session, so
// Postgres RLS decides what comes back.
export async function createClient() {
  const env = requireEnv();
  const cookieStore = await cookies();
  return createServerClient<Database, "app">(env.supabaseUrl, env.supabaseAnonKey, {
    db: { schema: "app" },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch (error) {
          // Server Components cannot write cookies; the proxy refreshes the
          // session on every navigation, so this is expected there. Log it so
          // a genuine failure in a Server Action is still visible.
          console.warn("[supabase] could not persist refreshed session cookies here:", error);
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
