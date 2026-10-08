import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/action-form";
import { MobileNav, SideNav } from "@/components/nav";
import { TenantMark } from "@/components/tenant-mark";
import { LoadProblem } from "@/components/ui";
import { tenantBranding } from "@/lib/brand";
import { requireEnv } from "@/lib/env";
import { buildNav } from "@/lib/nav";
import { getViewer } from "@/lib/session";
import { signOut } from "@/app/login/actions";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const res = await getViewer();
  if (res.status === "signed_out") redirect("/login");

  if (res.status === "error") {
    return (
      <div className="min-h-screen">
        <header className="bg-navy px-4 py-3 text-white">
          <span className="font-display text-lg font-semibold">Weaver Admin</span>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8">
          <LoadProblem message={res.error} />
        </main>
      </div>
    );
  }

  const v = res.viewer;
  const sections = buildNav(v.access, { opsEventId: v.opsEventId });
  // The community's own logo, shown once someone is signed in (the browser tab keeps Weaver's icon).
  const brand = tenantBranding(v.center, requireEnv().supabaseUrl);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 bg-navy lg:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto">
          <Link href="/" className="flex items-center gap-3 px-6 pb-2 pt-5">
            <TenantMark branding={brand} name={v.center.name} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold uppercase tracking-wider text-[#D7A15F]">{v.center.short_name ?? v.center.name}</span>
              <span className="font-display text-xl font-semibold text-white">Weaver Admin</span>
            </span>
          </Link>
          <SideNav sections={sections} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="relative flex items-center justify-between gap-3 bg-navy px-4 py-2 text-white lg:bg-white lg:text-ink lg:border-b lg:border-line">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav sections={sections} />
            <Link href="/" className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold lg:hidden">
              <TenantMark branding={brand} name={v.center.name} size={32} />
              <span className="truncate">{v.center.short_name ?? v.center.name}</span>
            </Link>
            <span className="hidden text-sm text-muted lg:inline">{v.center.name}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden max-w-[16rem] truncate text-sm sm:inline" title={v.email ?? undefined}>
              {v.displayName}
            </span>
            <ActionButton action={signOut} label="Sign out" pendingLabel="Signing out…" className="btn btn-secondary min-h-11 px-3" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
