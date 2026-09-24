"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/pathshala/committee", label: "Dashboard" },
  { href: "/pathshala/committee/actions", label: "Actions" },
  { href: "/pathshala/committee/templates", label: "Templates" },
  { href: "/pathshala/committee/year", label: "Create year" },
  { href: "/pathshala/committee/concerns", label: "Concerns" },
  { href: "/pathshala/committee/resolutions", label: "Resolutions" },
];

export function CommitteeTabs() {
  const pathname = usePathname();
  const active = [...TABS].reverse().find((t) => pathname === t.href || pathname.startsWith(t.href + "/"))?.href;
  return (
    <nav aria-label="Committee sections" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active === t.href ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ${
                active === t.href ? "border-purple text-purple" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
