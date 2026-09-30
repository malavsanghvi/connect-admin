import { describe, expect, it } from "vitest";

import { initials, tenantBranding } from "@/lib/brand";

const base = { name: "Jain Society of Houston", short_name: "JSH", slug: "jsh" };
const CENTER = "00000000-0000-4000-8000-000000000001";
const SUPABASE = "https://abc.supabase.co";

describe("tenantBranding", () => {
  it("prefers the uploaded square mark, then the horizontal logo, from the public branding bucket", () => {
    const both = tenantBranding({ ...base, branding: { mark_path: `${CENTER}/brand/mark-1.png`, logo_path: `${CENTER}/brand/logo-1.png` } }, SUPABASE);
    expect(both.logoUrl).toBe(`${SUPABASE}/storage/v1/object/public/branding/${CENTER}/brand/mark-1.png`);
    const logoOnly = tenantBranding({ ...base, branding: { logo_path: `${CENTER}/brand/logo-1.png` } }, SUPABASE);
    expect(logoOnly.logoUrl).toBe(`${SUPABASE}/storage/v1/object/public/branding/${CENTER}/brand/logo-1.png`);
  });
  it("falls back to an https mark_url or logo_url, and ignores anything that is not https", () => {
    expect(tenantBranding({ ...base, branding: { mark_url: "https://cdn.example.org/m.png" } }, SUPABASE).logoUrl).toBe("https://cdn.example.org/m.png");
    expect(tenantBranding({ ...base, branding: { logo_url: "https://cdn.example.org/l.svg" } }, SUPABASE).logoUrl).toBe("https://cdn.example.org/l.svg");
    expect(tenantBranding({ ...base, branding: { mark_url: "http://cdn.example.org/m.png" } }, SUPABASE).logoUrl).toBeNull();
    expect(tenantBranding({ ...base, branding: { mark_url: "javascript:alert(1)" } }, SUPABASE).logoUrl).toBeNull();
  });
  it("rejects a brand-kit path that is not <center id>/… or that climbs out of it", () => {
    expect(tenantBranding({ ...base, branding: { mark_path: "not-a-center/mark.png" } }, SUPABASE).logoUrl).toBeNull();
    expect(tenantBranding({ ...base, branding: { mark_path: `${CENTER}/../other/mark.png` } }, SUPABASE).logoUrl).toBeNull();
    expect(tenantBranding({ ...base, branding: { mark_path: `${CENTER}/brand/mark.png` } }, undefined).logoUrl).toBeNull();
  });
  it("gives a community with no logo its short name as initials, never a made-up logo", () => {
    expect(tenantBranding({ ...base, branding: {} }, SUPABASE)).toEqual({ logoUrl: null, monogram: "JSH", shortName: "JSH" });
    expect(tenantBranding({ ...base, short_name: null, branding: null }, SUPABASE)).toMatchObject({ logoUrl: null, monogram: "JSH", shortName: "JSH" });
    expect(tenantBranding({ name: "Orbit Test Community", short_name: "Long Short Name", slug: "orbit", branding: [] as never }, SUPABASE).monogram).toBe("OC");
  });
  it("initials handles blanks and single words", () => {
    expect(initials("")).toBe("?");
    expect(initials("priya")).toBe("P");
    expect(initials("Priya Shah")).toBe("PS");
  });
});
