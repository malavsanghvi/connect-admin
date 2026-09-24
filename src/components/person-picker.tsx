"use client";

import { useEffect, useRef, useState } from "react";

type Option = { id: string; name: string; detail: string | null };

const NONE: Option[] = [];

/**
 * Search people and pick one (or several). Submits hidden inputs named `name`.
 * Only people the signed-in user may see (RLS) are found.
 */
export function PersonPicker({
  name,
  label,
  multiple = false,
  initial = NONE,
  hint,
  required,
  endpoint = "/api/people",
  placeholder = "Type a name, email or phone",
}: {
  name: string;
  label: string;
  multiple?: boolean;
  initial?: Option[];
  hint?: string;
  required?: boolean;
  /** JSON search endpoint returning { ok, people: Option[] } (e.g. /api/households). */
  endpoint?: string;
  placeholder?: string;
}) {
  const [picked, setPicked] = useState<Option[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Option[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  // Clear the selection when the surrounding form is reset (after a successful create).
  useEffect(() => {
    const form = wrapper.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setPicked(initial);
      setQuery("");
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initial]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      setState("loading");
      try {
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const body = (await res.json()) as { ok: boolean; people?: Option[]; error?: string };
        if (!body.ok) throw new Error(body.error ?? "Search failed");
        setResults(body.people ?? []);
        setError(null);
        setState("idle");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        console.error("[person-picker] search failed", e);
        setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Couldn't search right now. Check your connection.");
        setState("error");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, attempt, endpoint]);

  function choose(o: Option) {
    setPicked((cur) => (multiple ? (cur.some((c) => c.id === o.id) ? cur : [...cur, o]) : [o]));
    setQuery("");
    setResults([]);
  }

  const showResults = query.trim().length >= 2;

  return (
    <div ref={wrapper}>
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {picked.map((p) => (
        <input key={p.id} type="hidden" name={name} value={p.id} />
      ))}
      {picked.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {picked.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-navy-soft py-1 pl-3 pr-1 text-sm">
              <span className="font-semibold text-navy">{p.name}</span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-white"
                onClick={() => setPicked((cur) => cur.filter((c) => c.id !== p.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {(multiple || picked.length === 0) && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="field-input"
          aria-label={`Search for ${label.toLowerCase()}`}
          required={required && picked.length === 0}
        />
      )}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {showResults && state === "loading" && <p className="mt-1 text-sm text-muted">Searching…</p>}
      {showResults && state === "error" && (
        <p role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-sm text-danger">
          {error}
          <button type="button" className="btn btn-danger min-h-9 px-3 py-1" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      )}
      {showResults && state === "idle" && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-white">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No one found that you&apos;re allowed to see.</li>}
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => choose(r)} className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left hover:bg-navy-soft">
                <span className="text-sm font-semibold">{r.name}</span>
                {r.detail && <span className="text-xs text-muted">{r.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
