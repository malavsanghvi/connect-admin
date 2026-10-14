import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { WeaverLogo } from "@/components/weaver-logo";
import { missingEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Setup" };

const VARS: { name: string; required: boolean; what: string }[] = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, what: "Your Supabase project URL, e.g. https://abcd.supabase.co" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, what: "The project's anon (public) key. Never use the service-role key here." },
  { name: "NEXT_PUBLIC_CENTER_SLUG", required: false, what: "Which community this console serves (centers.slug). Defaults to jsh." },
];

export default async function SetupPage() {
  await connection();
  const missing = missingEnv();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <WeaverLogo />
      <p className="mt-8 text-eyebrow uppercase text-brown">Weaver Admin</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-navy">Finish setting up</h1>
      {missing.length > 0 ? (
        <p className="mt-2 text-muted">
          This console can&apos;t reach the database yet because {missing.length === 1 ? "one setting is" : "some settings are"} missing.
          Add {missing.length === 1 ? "it" : "them"} to <code className="rounded-chip bg-track px-1">.env.local</code> (copy{" "}
          <code className="rounded-chip bg-track px-1">.env.example</code>) or your hosting provider&apos;s environment, then rebuild.
        </p>
      ) : (
        <p className="mt-2 text-muted">
          All required settings are present. <Link className="font-semibold text-navy underline" href="/">Continue to sign in</Link>.
        </p>
      )}
      <ul className="mt-6 space-y-3">
        {VARS.map((v) => {
          const isMissing = missing.includes(v.name);
          return (
            <li key={v.name} className="rounded-card border border-line bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all font-semibold">{v.name}</code>
                <span
                  className={
                    isMissing
                      ? "rounded-full bg-danger-50 px-2 text-xs font-semibold text-danger"
                      : "rounded-full bg-success-50 px-2 text-xs font-semibold text-success"
                  }
                >
                  {isMissing ? "Missing" : v.required ? "Set" : "Optional"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{v.what}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-muted">
        NEXT_PUBLIC_* values are read when the app is built. After changing them, restart <code>pnpm dev</code> or rebuild.
      </p>
    </main>
  );
}
