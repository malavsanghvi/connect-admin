// Links from this console to the Weaver portal (connect-crm). Pure: no server imports, unit-tested in
// tests/portal-links.test.ts. The portal's address is configuration (portalUrl() in @/lib/env,
// NEXT_PUBLIC_PORTAL_URL), never a fixed community, so every organization links to its own portal.

import { httpBaseUrl } from "@/lib/env";

/**
 * The portal's guided event creator (connect-crm /events/new). Events are created there; this console
 * is the event-day console. Null when the portal address is not an http(s) URL.
 */
export function portalNewEventLink(base: string | null | undefined): string | null {
  const b = httpBaseUrl(base);
  return b ? `${b}/events/new` : null;
}
