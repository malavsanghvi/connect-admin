"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { WeaverLogo } from "@/components/weaver-logo";
import type { NavSection } from "@/lib/nav";

function isActive(pathname: string, href: string, allHrefs: string[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  // Prefer the most specific match (e.g. /pathshala/classes over /pathshala).
  return !allHrefs.some((h) => h !== href && h.startsWith(href + "/") && (pathname === h || pathname.startsWith(h + "/")));
}

const accentBar = { pathshala: "bg-purple", events: "bg-maroon", navy: "bg-navy-200" } as const;

function Links({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = sections.flatMap((s) => s.items.map((i) => i.href));
  return (
    <div className="space-y-5">
      {sections.map((s) => (
        <div key={s.key}>
          <p className="mb-1 flex items-center gap-2 px-3 text-eyebrow uppercase text-navy-200">
            <span className={`h-2 w-2 rounded-full ${accentBar[s.accent]}`} aria-hidden />
            {s.label}
          </p>
          <ul>
            {s.items.map((item) => {
              const on = isActive(pathname, item.href, all);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-pill px-3 text-sm font-semibold ${
                      on ? "bg-white text-navy" : "text-white hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function SideNav({ sections }: { sections: NavSection[] }) {
  return (
    <nav aria-label="Main" className="on-navy px-3 py-4">
      <Links sections={sections} />
      <div className="mt-6 border-t border-white/15 px-3 pt-4">
        <WeaverLogo setting="light" />
      </div>
    </nav>
  );
}

export function MobileNav({ sections }: { sections: NavSection[] }) {
  const [open, setOpen] = useState(false);
  if (!sections.length) return null;
  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="btn btn-ghost-on-navy px-4"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close menu" : "Menu"}
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="on-navy absolute inset-x-0 top-full z-30 max-h-[75vh] overflow-y-auto bg-navy px-3 py-4 shadow-menu">
          <Links sections={sections} onNavigate={() => setOpen(false)} />
          <div className="mt-6 border-t border-white/15 px-3 pt-4">
            <WeaverLogo setting="light" />
          </div>
        </nav>
      )}
    </div>
  );
}
