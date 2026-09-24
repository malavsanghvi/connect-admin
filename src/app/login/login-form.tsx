"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { sendCode, verifyCode } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState<string | null>(null);

  if (!email) {
    return (
      <ActionForm
        action={sendCode}
        submitLabel="Email me a code"
        pendingLabel="Sending…"
        submitClassName="btn btn-primary w-full"
        successMessage={null}
        onDone={(r) => {
          if (r.ok && r.data && typeof r.data === "object" && "email" in r.data) setEmail(String((r.data as { email: string }).email));
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className="field-input"
            placeholder="you@example.com"
          />
        </label>
      </ActionForm>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        We emailed a sign-in code to <strong className="text-ink">{email}</strong>. It expires in a few minutes.
      </p>
      <ActionForm action={verifyCode} submitLabel="Sign in" pendingLabel="Checking…" submitClassName="btn btn-primary w-full" successMessage={null}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            required
            className="field-input text-center text-2xl tracking-[0.4em]"
            placeholder="••••••"
          />
        </label>
      </ActionForm>
      <button type="button" className="btn btn-secondary mt-3 w-full" onClick={() => setEmail(null)}>
        Use a different email or send a new code
      </button>
    </div>
  );
}
