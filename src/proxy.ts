import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { readEnv } from "@/lib/env";
import { requestIsHttps } from "@/lib/https";

// Proxy (formerly "middleware" — renamed in Next.js 16) does two jobs:
//  1. keeps the Supabase session cookie fresh on every navigation, and
//  2. makes an *optimistic* redirect to /login when there is no session.
// It is not the authorization layer: every page re-checks access and every
// Server Action re-checks permissions, and Postgres RLS enforces the rest.

const PUBLIC_PREFIXES = ["/login", "/setup", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const env = readEnv();

  if (!env) {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database, "app">(env.supabaseUrl, env.supabaseAnonKey, {
    db: { schema: "app" },
    // Secure session cookies whenever the request came over HTTPS (Caddy sets X-Forwarded-Proto).
    cookieOptions: { secure: requestIsHttps(request.headers.get("x-forwarded-proto")) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  let signedIn = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") {
      console.warn("[proxy] session check failed:", error.message);
    }
    signedIn = Boolean(data.user);
  } catch (error) {
    // Supabase unreachable: let the page render and report the problem in
    // plain English rather than bouncing the user to the login screen.
    console.error("[proxy] could not reach Supabase to check the session:", error);
    return response;
  }

  if (!signedIn && !isPublic(pathname)) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
