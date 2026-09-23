"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { requireEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient<Database, "app">> | null = null;

// Browser client for phone-first screens (check-in scanning, offline replay)
// where a round trip through a Server Action would add latency. Same session
// cookies, same RLS.
export function getBrowserClient() {
  if (!browserClient) {
    const env = requireEnv();
    browserClient = createBrowserClient<Database, "app">(env.supabaseUrl, env.supabaseAnonKey, {
      db: { schema: "app" },
    });
  }
  return browserClient;
}
