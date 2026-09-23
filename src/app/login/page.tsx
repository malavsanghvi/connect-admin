import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
        <p className="text-xs font-bold uppercase tracking-wider text-purple">Connect Admin</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-navy">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          For Pathshala teachers and committee, event leads, volunteers and office staff. We&apos;ll email you a one-time
          code — no password needed.
        </p>
        <div className="mt-6 rounded-xl border border-line bg-card p-5">
          <LoginForm next={next} />
        </div>
        {res.status === "error" && (
          <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            You&apos;re signed in, but your settings couldn&apos;t load: {res.error}
          </p>
        )}
      </div>
    </main>
  );
}
