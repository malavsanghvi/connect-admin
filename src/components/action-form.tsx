"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionResult } from "@/lib/result";

type ServerAction = (formData: FormData) => Promise<ActionResult<unknown>>;

const UNREACHABLE =
  "The request didn't reach the server. Check your connection and try again.";

function isNextControlFlow(error: unknown): boolean {
  const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest: unknown }).digest) : "";
  return digest.startsWith("NEXT_");
}

/**
 * A form wired to a Server Action that returns { ok, error }.
 * - Shows the plain-English error right beside the submit button, with "Try again"
 *   (which re-sends exactly what was submitted).
 * - Never clears what the user typed on failure (we submit via onSubmit rather
 *   than <form action>, which React resets automatically).
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  children,
  className,
  submitClassName = "btn btn-primary",
  resetOnSuccess = false,
  successMessage = "Saved.",
  confirm,
  layout = "stack",
  extraButtons,
  onDone,
}: {
  action: ServerAction;
  submitLabel: ReactNode;
  pendingLabel?: string;
  children?: ReactNode;
  className?: string;
  submitClassName?: string;
  resetOnSuccess?: boolean;
  successMessage?: string | null;
  confirm?: string;
  layout?: "stack" | "inline";
  extraButtons?: ReactNode;
  onDone?: (result: ActionResult<unknown>) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const lastData = useRef<FormData | null>(null);
  const [state, run, pending] = useActionState<ActionResult<unknown> | null, FormData>(async (_prev, formData) => {
    lastData.current = formData;
    try {
      return await action(formData);
    } catch (error) {
      // redirect() from a Server Action rejects with a Next.js control-flow
      // error that the router must handle — let it through.
      if (isNextControlFlow(error)) throw error;
      console.error("[action-form] server action failed to run", error);
      return { ok: false, error: UNREACHABLE };
    }
  }, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok && resetOnSuccess) formRef.current?.reset();
    onDone?.(state);
    // onDone is intentionally not a dependency: it only fires on a new result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, resetOnSuccess]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (confirm && !window.confirm(confirm)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => run(fd));
  }

  function retry() {
    const fd = lastData.current;
    if (fd) startTransition(() => run(fd));
  }

  const inline = layout === "inline";
  return (
    <form ref={formRef} onSubmit={submit} className={className} noValidate={false}>
      {children}
      <div className={inline ? "inline-flex flex-wrap items-center gap-2" : "mt-4 flex flex-wrap items-center gap-2"}>
        <button type="submit" className={submitClassName} disabled={pending}>
          {pending ? (pendingLabel ?? "Saving…") : submitLabel}
        </button>
        {extraButtons}
        {!pending && state?.ok && (state.message ?? successMessage) && (
          <span role="status" className="text-sm font-semibold text-success">
            ✓ {state.message ?? successMessage}
          </span>
        )}
      </div>
      {!pending && state && !state.ok && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          <span className="min-w-0 flex-1">{state.error}</span>
          <button type="button" onClick={retry} className="btn btn-danger min-h-9 px-3 py-1">
            Try again
          </button>
        </div>
      )}
    </form>
  );
}

/** A single button bound to a Server Action (with optional hidden fields). */
export function ActionButton({
  action,
  label,
  fields,
  className = "btn btn-secondary",
  confirm,
  pendingLabel,
  successMessage = null,
}: {
  action: ServerAction;
  label: ReactNode;
  fields?: Record<string, string>;
  className?: string;
  confirm?: string;
  pendingLabel?: string;
  successMessage?: string | null;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel={label}
      submitClassName={className}
      confirm={confirm}
      pendingLabel={pendingLabel ?? "Working…"}
      successMessage={successMessage}
      layout="inline"
      className="inline-block max-w-full"
    >
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </ActionForm>
  );
}
