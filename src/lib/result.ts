// Every Server Action returns an ActionResult. The UI shows `error` in plain
// English beside the control, with a retry. Technical detail goes to the
// server log (never swallowed, never console-only on the client).

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string };

export function ok<T = undefined>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

type DbError = { message?: string; code?: string; details?: string | null; hint?: string | null } | null | undefined;

/** Turn a PostgREST / Postgres / network error into a sentence a volunteer can act on. */
export function friendlyError(error: DbError | unknown, doing = "save that"): string {
  const e = (error ?? {}) as { message?: string; code?: string; name?: string };
  const msg = (e.message ?? String(error ?? "")).trim();
  const code = e.code ?? "";
  const lower = msg.toLowerCase();

  if (code === "42501" || lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("not allowed")) {
    return `You don't have permission to ${doing}. Ask the office if you think you should.`;
  }
  if (code === "23505" || lower.includes("duplicate key")) {
    return `Could not ${doing}: a record like this already exists.`;
  }
  if (code === "23503" || lower.includes("foreign key")) {
    return `Could not ${doing}: it is linked to other records that are missing or still in use.`;
  }
  if (lower.includes("violates check constraint")) {
    return `Could not ${doing}: one of the values isn't allowed. Check the form and try again.`;
  }
  if (code === "23514" && msg) {
    // Business rules raised by database triggers (e.g. the two-person rule) carry their own plain-English reason.
    return `Could not ${doing}: ${msg}.`;
  }
  if (code === "23502" || lower.includes("null value in column")) {
    return `Could not ${doing}: a required field is empty.`;
  }
  if (code === "22P02" || lower.includes("invalid input syntax")) {
    return `Could not ${doing}: one of the values is in the wrong format.`;
  }
  if (code === "PGRST116") {
    return `Could not ${doing}: the record was not found, or you can't see it.`;
  }
  if ((e.name === "TypeError" && lower.includes("fetch")) || lower.includes("failed to fetch") || lower.includes("network")) {
    return `Could not ${doing}: the server can't be reached. Check your connection and try again.`;
  }
  if (!msg) return `Could not ${doing}. Please try again.`;
  // Database functions raise plain-English messages (e.g. "this boli is not open for pledges").
  return `Could not ${doing}: ${msg.replace(/^error:\s*/i, "")}.`.replace(/\.\.$/, ".");
}

/** Log the technical detail server-side and return the plain-English version. */
export function reportError(context: string, error: unknown, doing?: string): { ok: false; error: string } {
  console.error(`[${context}]`, error);
  return fail(friendlyError(error, doing));
}
