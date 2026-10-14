import { describe, expect, it } from "vitest";

import { kindFromProfileResult, kindName, NEUTRAL_KIND, parseKindProfile } from "@/lib/kind";
import { moduleLabels, NEUTRAL_LABELS } from "@/lib/labels";
import { buildNav } from "@/lib/nav";
import { computeAccess } from "@/lib/access";

// The shape app.category_profile(center) answers with (connect-crm 0594).
const school = {
  category: { key: "school_kind", label: "Heritage school", terms: { school: "Madrasa", learning: "Quran path", store: "Shop" } },
  modules: { pathshala: { availability: "default_on", label: null }, gyan_path: { availability: "default_on", label: null }, bolis: { availability: "not_available", label: null } },
};
const withBolis = {
  category: { key: "temple", label: "Temple", terms: { school: "Pathshala", learning: "Gyan Path", store: "My Store" } },
  modules: { bolis: { availability: "default_on", label: null } },
};
const renamed = {
  category: { key: "other_faith", label: "Faith community", terms: {} },
  modules: { pathshala: { availability: "default_off", label: "Religious school" }, gyan_path: { availability: "default_off", label: "Learning path" } },
};

describe("the community's kind", () => {
  it("reads the database's answer, keeps its terms and module rows, and rejects anything else", () => {
    const kind = parseKindProfile(school);
    expect(kind?.label).toBe("Heritage school");
    expect(kind?.terms.school).toBe("Madrasa");
    expect(kind?.modules.bolis.availability).toBe("not_available");
    expect(parseKindProfile(null)).toBeNull();
    expect(parseKindProfile([] as never)).toBeNull();
    expect(parseKindProfile({ category: { key: "", label: "x" } })).toBeNull();
  });

  it("shows the neutral kind, and says so, when the lookup fails or answers with something unreadable", () => {
    expect(kindFromProfileResult({ data: null, error: new Error("down") })).toEqual({ kind: NEUTRAL_KIND, status: "error" });
    expect(kindFromProfileResult({ data: { nope: true }, error: null })).toEqual({ kind: NEUTRAL_KIND, status: "error" });
    expect(kindFromProfileResult({ data: school, error: null }).status).toBe("ok");
  });

  it("names a module by the kind's own name, then its term, then the fallback", () => {
    expect(kindName(parseKindProfile(renamed)!, "pathshala", "x")).toBe("Religious school");
    expect(kindName(parseKindProfile(school)!, "pathshala", "x")).toBe("Madrasa");
    expect(kindName(NEUTRAL_KIND, "pathshala", "Fallback")).toBe("Fallback");
  });
});

describe("module labels", () => {
  it("come from the community's kind", () => {
    expect(moduleLabels(parseKindProfile(school)!)).toEqual({ school: "Madrasa", signoffs: "Quran path sign-offs", pledges: NEUTRAL_LABELS.pledges, store: "Shop" });
    expect(moduleLabels(parseKindProfile(renamed)!)).toMatchObject({ school: "Religious school", signoffs: "Learning path sign-offs" });
  });

  it("use the module's catalog name when the kind offers it and has not renamed it", () => {
    expect(moduleLabels(parseKindProfile(withBolis)!)).toMatchObject({ pledges: "Bolis", school: "Pathshala", signoffs: "Gyan Path sign-offs", store: "My Store" });
  });

  it("are neutral for a kind that does not offer the module and when the kind cannot be read", () => {
    expect(moduleLabels(NEUTRAL_KIND)).toEqual(NEUTRAL_LABELS);
  });

  it("name the navigation sections and items", () => {
    const access = computeAccess({ grants: [], roles: [], isPlatformAdmin: true });
    const nav = buildNav(access, { labels: moduleLabels(parseKindProfile(school)!) });
    expect(nav.map((s) => s.label)).toContain("Madrasa");
    expect(nav.flatMap((s) => s.items.map((i) => i.label))).toContain("Quran path sign-offs");
    const neutral = buildNav(access);
    expect(neutral.map((s) => s.label)).toContain(NEUTRAL_LABELS.school);
    expect(neutral.flatMap((s) => s.items.map((i) => i.label))).toContain(NEUTRAL_LABELS.pledges);
  });
});
