import Link from "next/link";
import type { ReactNode } from "react";
import { RetryButton } from "@/components/retry-button";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Accent = "navy" | "pathshala" | "events" | "store";
const accentText: Record<Accent, string> = {
  navy: "text-navy",
  pathshala: "text-purple",
  events: "text-maroon",
  store: "text-store",
};

export function PageHeader({
  title,
  kicker,
  description,
  actions,
  accent = "navy",
  back,
}: {
  title: string;
  kicker?: string;
  description?: ReactNode;
  actions?: ReactNode;
  accent?: Accent;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex min-h-11 items-center text-sm font-semibold text-navy hover:underline">
            ← {back.label}
          </Link>
        )}
        {kicker && <p className={cx("text-xs font-bold uppercase tracking-wider", accentText[accent])}>{kicker}</p>}
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        {description && <div className="mt-1 max-w-3xl text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("rounded-xl border border-line bg-card p-4 sm:p-5", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export type Tone = "neutral" | "navy" | "success" | "danger" | "warning" | "purple" | "maroon" | "muted" | "caution" | "ok";
const toneClass: Record<Tone, string> = {
  neutral: "bg-sand text-ink border-line",
  navy: "bg-navy-soft text-navy border-navy/20",
  success: "bg-success-soft text-success border-success/20",
  ok: "bg-success-soft text-success border-success/20",
  danger: "bg-danger-soft text-danger border-danger/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  caution: "bg-[#FBF6DC] text-[#6B5A00] border-[#6B5A00]/20",
  purple: "bg-purple-soft text-purple border-purple/20",
  maroon: "bg-maroon-soft text-maroon border-maroon/20",
  muted: "bg-white text-muted border-line",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", toneClass[tone])}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, tone = "navy" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "navy" | "purple" | "maroon" | "success" | "danger" | "warning" }) {
  const color = { navy: "text-navy", purple: "text-purple", maroon: "text-maroon", success: "text-success", danger: "text-danger", warning: "text-warning" }[tone];
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cx("mt-1 font-display text-3xl font-semibold", color)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-ground/60 p-6 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function NoAccess({ area, children }: { area?: string; children?: ReactNode }) {
  return (
    <div role="alert" className="mx-auto max-w-xl rounded-xl border border-line bg-card p-6 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">No access</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">You don&apos;t have access to this area</h1>
      <p className="mt-2 text-sm text-muted">
        {children ??
          `Your role doesn't include ${area ? area : "this part of Connect Admin"}. If you need it, ask your center admin or the office to grant the right role.`}
      </p>
      <Link href="/" className="btn btn-secondary mt-4">
        Go to my home
      </Link>
    </div>
  );
}

export function LoadProblem({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-danger">
      <p className="font-semibold">This page couldn&apos;t load.</p>
      <p className="mt-1 text-sm">{message}</p>
      <div className="mt-3">
        <RetryButton />
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Checkbox({ name, label, defaultChecked, value = "on", hint }: { name: string; label: string; defaultChecked?: boolean; value?: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 shrink-0 accent-navy" />
      <span>
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const c = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[cols];
  return <div className={cx("grid grid-cols-1 gap-4", c)}>{children}</div>;
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Sections" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold",
                  on ? "border-navy text-navy" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined && <span className="rounded-full bg-sand px-2 text-xs text-ink">{t.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Horizontal scrolling happens inside the table box, never the page. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-4 overflow-x-auto sm:mx-0">{children}</div>;
}

export const th = "border-b border-line px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted whitespace-nowrap";
export const td = "border-b border-line px-3 py-2 align-top text-sm";

export function Notice({ tone = "navy", children }: { tone?: "navy" | "warning" | "danger" | "success"; children: ReactNode }) {
  const c = {
    navy: "border-navy/20 bg-navy-soft text-navy",
    warning: "border-warning/20 bg-warning-soft text-warning",
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/20 bg-success-soft text-success",
  }[tone];
  return <div className={cx("rounded-lg border p-3 text-sm", c)}>{children}</div>;
}

export function Details({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 font-semibold text-navy">
        <span>{summary}</span>
        <span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col border-b border-line/70 py-1.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
          <dd className="text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Select({
  name,
  options,
  defaultValue,
  required,
  placeholder,
  id,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  id?: string;
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? ""} required={required} className="field-input">
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
