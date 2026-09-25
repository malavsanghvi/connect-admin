import { describe, expect, it } from "vitest";

import { APP_HTTPS_PORTS, buildAppSites } from "../deploy/caddy-sites.mjs";
import { requestIsHttps } from "@/lib/https";

// e-https-admin: the event-day app on its own HTTPS port. deploy/caddy-sites.mjs is a copy of
// connect-crm's (its full tests live there, tests/caddy-sites.test.ts); this checks the copy
// shipped with this app's deploy produces this app's site.
describe("requestIsHttps", () => {
  it("reads the first X-Forwarded-Proto value", () => {
    expect(requestIsHttps("https")).toBe(true);
    expect(requestIsHttps("HTTPS, http")).toBe(true);
    expect(requestIsHttps("http")).toBe(false);
    expect(requestIsHttps("http, https")).toBe(false);
    expect(requestIsHttps(null)).toBe(false);
    expect(requestIsHttps(undefined)).toBe(false);
  });
});

describe("deploy/caddy-sites.mjs (this app's copy)", () => {
  it("serves the event-day app on 8444 and keeps http://…:8081", () => {
    expect(APP_HTTPS_PORTS.admin).toBe(8444);
    const { files } = buildAppSites({ app: "admin", port: 3001, site: ":8081", publicIp: "134.122.25.56", ipCert: true });
    expect(Object.keys(files)).toEqual(["admin.caddy"]);
    const site = files["admin.caddy"];
    expect(site).toContain(":8081 {");
    expect(site).toContain("redir @https_ready https://{host}:8444{uri} 308");
    expect(site).toContain("https://:8444 {");
    expect(site).toContain("https://134.122.25.56:8444 {");
    expect(site).toContain("reverse_proxy 127.0.0.1:3001");
    expect(site).not.toContain("on_demand_tls");
  });
});
