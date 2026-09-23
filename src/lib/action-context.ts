import "server-only";

import type { Access } from "@/lib/access";
import { FormError } from "@/lib/forms";
import { viewerForAction } from "@/lib/session";

/**
 * Every Server Action starts here: re-check the session and the permission
 * (Server Actions are reachable by direct POST, so the page's check is not
 * enough). RLS remains the final word on every row.
 */
export async function actionContext(check?: (a: Access) => boolean, denied = "You don't have permission to do that.") {
  const ctx = await viewerForAction();
  if (!ctx.ok) throw new FormError(ctx.error);
  if (check && !check(ctx.viewer.access)) throw new FormError(denied);
  return { viewer: ctx.viewer, supabase: ctx.supabase, centerId: ctx.viewer.center.id, tz: ctx.viewer.center.time_zone };
}
