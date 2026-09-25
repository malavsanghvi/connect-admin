// e-https-admin: the event-day app is served over HTTPS on its own port (8444) next to
// http://…:8081. Caddy tells the app how the browser connected in X-Forwarded-Proto;
// session cookies are marked Secure on HTTPS requests only, so sign-in keeps working on
// the plain http:// address.

/** True when the request reached Caddy over HTTPS (the first X-Forwarded-Proto value). */
export function requestIsHttps(forwardedProto: string | null | undefined): boolean {
  return (forwardedProto ?? "").split(",")[0].trim().toLowerCase() === "https";
}
