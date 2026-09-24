"use client";

import { useEffect } from "react";

export default function ConsoleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[console] page failed to render", error);
  }, [error]);

  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-5 text-danger">
      <p className="font-semibold">Something went wrong while loading this page.</p>
      <p className="mt-1 text-sm">
        The problem has been logged{error.digest ? ` (reference ${error.digest})` : ""}. Try again; if it keeps happening,
        tell the office what you were doing.
      </p>
      <button type="button" className="btn btn-danger mt-3" onClick={() => retry()}>
        Try again
      </button>
    </div>
  );
}
