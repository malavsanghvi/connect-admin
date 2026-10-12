import { describe, expect, it } from "vitest";

import { portalNewEventLink } from "@/lib/logic/portal-links";

describe("portalNewEventLink", () => {
  it("links to the portal's guided event creator", () => {
    expect(portalNewEventLink("https://portal.example.org")).toBe("https://portal.example.org/events/new");
    expect(portalNewEventLink("https://weaver.example.net/connect")).toBe("https://weaver.example.net/connect/events/new");
  });
  it("trims trailing slashes and spaces from the base", () => {
    expect(portalNewEventLink(" https://portal.example.org/ ")).toBe("https://portal.example.org/events/new");
    expect(portalNewEventLink("http://localhost:3000//")).toBe("http://localhost:3000/events/new");
  });
  it("is null for a base that is not an http(s) URL, so the page names the portal in plain text", () => {
    for (const base of [null, undefined, "", "   ", "portal.example.org", "ftp://portal.example.org", "javascript:alert(1)", "https://", "https://portal.example.org?x=1"]) {
      expect(portalNewEventLink(base)).toBeNull();
    }
  });
});
