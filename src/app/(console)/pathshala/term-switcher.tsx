import Link from "next/link";
import { cx } from "@/components/ui";

export function TermSwitcher({
  terms,
  activeId,
  basePath,
}: {
  terms: { id: string; name: string; status: string }[];
  activeId: string | null;
  basePath: string;
}) {
  if (terms.length <= 1) return null;
  return (
    <nav aria-label="Term" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-2">
        {terms.map((t) => (
          <li key={t.id}>
            <Link
              href={`${basePath}?term=${t.id}`}
              aria-current={t.id === activeId ? "page" : undefined}
              className={cx(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
                t.id === activeId ? "border-purple bg-purple text-white" : "border-line bg-white text-purple hover:bg-purple-soft",
              )}
            >
              {t.name}
              <span className="ml-2 text-xs font-normal opacity-80">{t.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
