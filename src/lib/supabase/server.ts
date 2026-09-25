import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/database.types";
import { requireEnv } from "@/lib/env";
import { requestIsHttps } from "@/lib/https";

// One client per request (never shared). Reads use the caller's session, so
// Postgres RLS decides what comes back.
export async function createClient() {
  const env = requireEnv();
  const cookieStore = await cookies();
  let https = false;
  try {
    https = requestIsHttps((await headers()).get("x-forwarded-proto"));
  } catch (error) {
    // Outside a request there are no headers; cookies written then are not Secure.
    console.error("[supabase] could not read X-Forwarded-Proto; session cookies set here are not marked Secure:", error);
  }
  return createServerClient<Database, "app">(env.supabaseUrl, env.supabaseAnonKey, {
    db: { schema: "app" },
    cookieOptions: { secure: https },
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
