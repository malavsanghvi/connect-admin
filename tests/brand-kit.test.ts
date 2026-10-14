// Guards for the Weaver Brand Kit (docs/BRAND_CONFORMANCE.md): the theme is generated from the kit's tokens, no colour
// is written anywhere else, the product is always "Weaver", and the type, shape and voice rules the kit sets stay set.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FONT_VARIABLES, renderTokens } from "../scripts/sync-brand-tokens.mjs";
import { PRODUCT_DESCRIPTOR, PRODUCT_NAME, kitColor } from "@/lib/brand-kit";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

/** Every file under `dir` (relative to the repo root) with one of the extensions, as repo-relative posix paths. */
function filesUnder(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const name of readdirSync(abs)) {
      const p = join(abs, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (exts.some((e) => name.endsWith(e))) out.push(relative(ROOT, p).split(sep).join("/"));
    }
  };
  walk(join(ROOT, dir));
  return out;
}

// The generated database types are not hand-written UI, and are copied from connect-crm.
const SOURCE = [...filesUnder("src", [".ts", ".tsx", ".css", ".svg"]), ...filesUnder("public", [".css", ".svg", ".html"])].filter(
  (f) => f !== "src/lib/database.types.ts",
);

function hits(files: string[], re: RegExp, { skipComments = false }: { skipComments?: boolean } = {}): string[] {
  const found: string[] = [];
  for (const f of files) {
    read(f)
      .split("\n")
      .forEach((line, i) => {
        if (skipComments && /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return;
        const m = line.match(re);
        if (m) found.push(`${f}:${i + 1}: ${m[0]}`);
      });
  }
  return found;
}

describe("the theme is the brand kit", () => {
  it("src/app/brand-tokens.css is exactly what brand/tokens.json generates (run `pnpm brand:sync` after changing the kit)", () => {
    const expected = renderTokens(JSON.parse(read("brand/tokens.json")));
    expect(read("src/app/brand-tokens.css")).toBe(expected);
  });

  it("every colour in the kit's tokens.json is a #rrggbb value or a reference to one", () => {
    const kit = JSON.parse(read("brand/tokens.json"));
    expect(kit.name).toBe("Weaver Brand Kit");
    for (const t of kit.color.tokens) expect(t.value, t.name).toMatch(/^(#[0-9a-f]{6}|\{[a-z0-9-]+\})$/);
  });

  it("the generated theme carries the kit's brand colours, its two faces and the 48px tap target", () => {
    const css = read("src/app/brand-tokens.css");
    expect(css).toContain("--color-navy: #2b2a8a;");
    expect(css).toContain("--color-canvas: #fffaf5;");
    expect(css).toMatch(/--font-display: var\(--font-bricolage, "Bricolage Grotesque"\)/);
    expect(css).toMatch(/--font-sans: var\(--font-hanken, "Hanken Grotesk"\)/);
    expect(css).toContain("--spacing-tap-target: 48px;");
    expect(css).not.toContain("--color-mark-"); // the mark's colours are the logo's, never the interface's
    expect(kitColor("navy")).toBe("#2b2a8a");
    expect(() => kitColor("no-such-colour")).toThrow();
  });

  it("layout.tsx loads Bricolage Grotesque (with its optical-size axis) and Hanken Grotesk under the variables the theme names", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/Bricolage_Grotesque\(\{[^}]*variable: "--font-bricolage"[^}]*axes: \["opsz"\]/);
    expect(layout).toMatch(/Hanken_Grotesk\(\{[^}]*variable: "--font-hanken"/);
    expect(FONT_VARIABLES).toEqual({ display: "--font-bricolage", sans: "--font-hanken" });
    expect(layout).not.toMatch(/Fraunces|DM_Sans/);
    // TODO(kit): the kit is adding JetBrains Mono for identifiers; until then it is the font-mono-pending face.
    expect(layout).toMatch(/JetBrains_Mono\(\{[^}]*variable: "--font-jetbrains-mono"/);
    expect(read("src/app/pending-kit-tokens.css")).toContain('var(--font-jetbrains-mono, "JetBrains Mono")');
  });

  it("the favicon and the logo file are the kit's mark, one file in two places", () => {
    expect(read("src/app/icon.svg")).toBe(read("public/brand/weaver-mark.svg"));
    expect(read("public/brand/weaver-mark.svg")).toContain("<title>Weaver</title>");
  });
});

// A colour value may be written only in these files. Every entry says why; keep the list short.
const COLOUR_ALLOWLIST: Record<string, string> = {
  "src/app/brand-tokens.css": "generated from brand/tokens.json: the one place the kit's colours are written",
  // TODO(kit): delete this entry and the file when the kit's own control-border token is vendored (docs/BRAND_CONFORMANCE.md, "Waiting on the kit").
  "src/app/pending-kit-tokens.css": "TEMPORARY: one colour (a 3:1 control border) the kit is still adding; every other value in it aliases a kit token",
  "src/app/icon.svg": "the official Weaver mark, a verbatim copy of the kit's logos/weaver-mark.svg: its colours are the logo's own",
  "public/brand/weaver-mark.svg": "the same official mark, served to the page for the logo lockup and the web manifest",
};

describe("no colour is written outside the token files", () => {
  const files = SOURCE.filter((f) => !(f in COLOUR_ALLOWLIST));

  it("the allowlist names only files that exist", () => {
    for (const f of Object.keys(COLOUR_ALLOWLIST)) expect(SOURCE, f).toContain(f);
  });

  it("has no hex colour, rgb()/hsl()/oklch() value or Tailwind default-palette class", () => {
    const found = [
      ...hits(files, /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b/),
      ...hits(files, /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/),
      ...hits(files, /(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|accent|caret|decoration|placeholder|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/),
      ...hits(files, /(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|accent)-black\b/),
    ];
    expect(found, "use a kit token (bg-navy, text-muted, border-line, ...) instead of a colour value").toEqual([]);
  });

  it("does not use the names of the colours the app had before the kit", () => {
    const retired = /(?<![\w-])(?:bg|text|border|ring|accent|divide|from|to|via|fill|stroke|outline|decoration|caret|placeholder)-(?:navy-soft|navy-deep|success-soft|danger-soft|warning(?:-soft)?|sand|card|maroon-50|purple-50)(?![\w-])/;
    expect(hits(files, retired)).toEqual([]);
  });

  it("has no module colours: purple, maroon and store green are folded into navy, brown and success", () => {
    const accents = /(?<![\w-])(?:(?:bg|text|border|ring|accent|divide|from|to|via|fill|stroke|outline)-(?:purple|maroon|store)(?:-soft)?|btn-(?:purple|maroon))(?![\w-])/;
    expect(hits(files, accents)).toEqual([]);
  });

  it("keeps the temporary kit tokens clearly temporary: every name ends in -pending, a TODO(kit) says why, and the control border is 3:1", () => {
    const css = read("src/app/pending-kit-tokens.css");
    expect(css).toContain("TODO(kit)");
    const names = [...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(n, n).toMatch(/-pending$/);
    const border = css.match(/--color-control-border-pending:\s*(#[0-9a-f]{6})/i)?.[1] ?? "";
    expect(contrast(border, kitColor("white"))).toBeGreaterThanOrEqual(3);
    expect(contrast(border, kitColor("canvas"))).toBeGreaterThanOrEqual(3);
  });
});

describe("shape, size and type follow the kit", () => {
  const ui = SOURCE.filter((f) => /\.(tsx|css)$/.test(f) && f !== "src/app/brand-tokens.css");

  it("uses the kit's radii (rounded-card, -tile, -pill, -chip, -logo-tile), not Tailwind's rounded, -md, -lg, -xl or -2xl", () => {
    expect(hits(ui, /(?<=["'` ])rounded(?:-(?:sm|md|lg|xl|2xl|3xl))?(?=["'` ])/)).toEqual([]);
  });

  it("uses the kit's menu shadow, not Tailwind's shadow-sm to -2xl", () => {
    expect(hits(ui, /(?<![\w-])shadow-(?:xs|sm|md|lg|xl|2xl)(?![\w-])/)).toEqual([]);
  });

  it("sets no control shorter than 44px (min-h-11)", () => {
    expect(hits(ui, /(?<![\w:-])min-h-(?:[1-9]|10)(?![\w.-])/)).toEqual([]);
  });

  it("buttons and fields are at least the kit's tap target tall", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/@utility btn \{[^}]*min-height: var\(--spacing-tap-target\)/);
    expect(css).toMatch(/@utility field-input \{[^}]*min-height: var\(--spacing-tap-target\)/);
    expect(css).toMatch(/@utility btn \{[^}]*border-radius: var\(--radius-pill\)/);
  });

  it("keeps 12px text (text-xs) to the compact word-bearing chips; everything else is the kit's caption size or larger", () => {
    const allowed = ["src/components/ui.tsx", "src/app/(console)/comms/page.tsx", "src/app/setup/page.tsx"];
    expect(hits(ui.filter((f) => !allowed.includes(f)), /(?<![\w-])text-xs(?![\w-])/)).toEqual([]);
  });

  it("draws focus as the kit says: a 2px solid navy outline, offset 2px", () => {
    expect(read("src/app/globals.css")).toMatch(/focus-visible \{\s*outline: 2px solid var\(--color-navy\);\s*outline-offset: 2px;/);
  });
});

describe("module names come from the community, not from code", () => {
  it("has no tradition's words in the navigation builder or the nav component", () => {
    expect(hits(["src/lib/nav.ts", "src/components/nav.tsx"], /\b(?:Pathshala|Bolis?|Gyan)\b/, { skipComments: true })).toEqual([]);
  });
});

describe("the product is Weaver, in the kit's voice", () => {
  const text = SOURCE.filter((f) => /\.(ts|tsx)$/.test(f));

  it("is named Weaver, with the kit's descriptor", () => {
    expect(PRODUCT_NAME).toBe("Weaver");
    expect(PRODUCT_DESCRIPTOR).toBe("Community management platform");
  });

  it('never says "Community Connect" (or "the Connect app", "Connect login": the member app is the member app)', () => {
    expect(hits(SOURCE, /Community Connect/i)).toEqual([]);
    expect(hits(text, /\bConnect (?:Admin|CRM|app|login)\b/)).toEqual([]);
  });

  it('says "pledge", never "bid" (founder rule)', () => {
    expect(hits(text, /(?<![\w-])bid(?:s|ding)?(?![\w-])/i, { skipComments: true })).toEqual([]);
  });

  it("uses no emoji and no exclamation marks in what people read", () => {
    expect(hits(text, /\p{Extended_Pictographic}/u)).toEqual([]);
    expect(hits(text, /[A-Za-z0-9.)'’]!(?=["'`<]| [A-Za-z])/)).toEqual([]);
  });
});
