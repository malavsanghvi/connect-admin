import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WeaverLogo } from "@/components/weaver-logo";
import { getViewer } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const res = await getViewer();
  if (res.status === "ok") redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <WeaverLogo />
        <p className="mt-8 text-eyebrow uppercase text-brown">Weaver Admin</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-navy">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          For teachers and committee members, event leads, volunteers and office staff. We&apos;ll email you a one-time
          code — no password needed.
        </p>
        <div className="mt-6 rounded-card border border-line bg-white p-5">
          <LoginForm next={next} />
        </div>
        {res.status === "error" && (
          <p role="alert" className="mt-4 rounded-tile border border-danger/30 bg-danger-50 p-3 text-sm text-danger">
            You&apos;re signed in, but your settings couldn&apos;t load: {res.error}
          </p>
        )}
      </div>
    </main>
  );
}
