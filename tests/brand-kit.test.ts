// Guards for the Weaver Brand Kit (docs/BRAND_CONFORMANCE.md): the theme is generated from the kit's tokens, no colour
// is written anywhere else, the product is always "Weaver", and the type, shape and voice rules the kit sets stay set.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FONT_VARIABLES, readIcons, renderIcons, renderTokens } from "../scripts/sync-brand-tokens.mjs";
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

  it("src/components/brand-icons.generated.ts is exactly what brand/icons generates, and every icon in use exists", () => {
    const kit = JSON.parse(read("brand/tokens.json"));
    const icons = readIcons(kit, join(ROOT, "brand/icons"));
    expect(icons.length).toBe(42);
    expect(read("src/components/brand-icons.generated.ts")).toBe(renderIcons(icons));
    const names = new Set(icons.map((i: string[]) => i[0]));
    const used = SOURCE.filter((f) => f.endsWith(".tsx")).flatMap((f) => [...read(f).matchAll(/<Icon name="([a-z-]+)"/g)].map((m) => m[1]));
    expect(used.length).toBeGreaterThan(0);
    for (const n of used) expect(names.has(n), n).toBe(true);
  });

  it("every colour in the kit's tokens.json is a #rrggbb value or a reference to one", () => {
    const kit = JSON.parse(read("brand/tokens.json"));
    expect(kit.name).toBe("Weaver Brand Kit");
    for (const t of kit.color.tokens) expect(t.value, t.name).toMatch(/^(#[0-9a-f]{6}|\{[a-z0-9-]+\})$/);
  });

  it("the generated theme carries the kit's brand colours, its three faces and its control sizes", () => {
    const css = read("src/app/brand-tokens.css");
    expect(css).toContain("--color-navy: #2b2a8a;");
    expect(css).toContain("--color-canvas: #fffaf5;");
    expect(css).toMatch(/--font-display: var\(--font-bricolage, "Bricolage Grotesque"\)/);
    expect(css).toMatch(/--font-sans: var\(--font-hanken, "Hanken Grotesk"\)/);
    expect(css).toMatch(/--font-mono: var\(--font-jetbrains-mono, "JetBrains Mono"\)/);
    expect(css).toContain("--spacing-tap-target: 48px;");
    expect(css).toContain("--spacing-control-primary: 52px;");
    for (const t of ["--color-line-control", "--color-faint", "--color-warning-ink", "--color-warning-50", "--color-saffron-strong", "--radius-field", "--radius-tag", "--text-identifier"]) expect(css, t).toContain(t + ":");
    expect(css).not.toContain("--color-mark-"); // the mark's colours are the logo's, never the interface's
    expect(kitColor("navy")).toBe("#2b2a8a");
    expect(() => kitColor("no-such-colour")).toThrow();
  });

  it("layout.tsx loads Bricolage Grotesque (with its optical-size axis), Hanken Grotesk and JetBrains Mono under the variables the theme names", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/Bricolage_Grotesque\(\{[^}]*variable: "--font-bricolage"[^}]*axes: \["opsz"\]/);
    expect(layout).toMatch(/Hanken_Grotesk\(\{[^}]*variable: "--font-hanken"/);
    expect(FONT_VARIABLES).toEqual({ display: "--font-bricolage", sans: "--font-hanken", mono: "--font-jetbrains-mono" });
    expect(layout).not.toMatch(/Fraunces|DM_Sans/);
    expect(layout).toMatch(/JetBrains_Mono\(\{[^}]*variable: "--font-jetbrains-mono"/);
  });

  it("the kit's text and fill pairs pass the contrast the kit claims for them", () => {
    const pair = (fg: string, bg: string, min: number) => expect(contrast(kitColor(fg), kitColor(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
    pair("line-control", "white", 3);
    pair("line-control", "canvas", 3);
    for (const bg of ["white", "canvas", "ground"]) pair("faint", bg, 4.5);
    pair("warning-ink", "warning-50", 4.5);
    pair("warning", "warning-50", 4.5);
    pair("saffron-strong", "white", 4.5);
    pair("brown", "white", 4.5);
    pair("success", "success-50", 4.5);
    pair("danger", "danger-50", 4.5);
    pair("muted", "canvas", 4.5);
  });

  it("the favicon and the logo file are the kit's mark, one file in two places", () => {
    expect(read("src/app/icon.svg")).toBe(read("public/brand/weaver-mark.svg"));
    expect(read("public/brand/weaver-mark.svg")).toContain("<title>Weaver</title>");
  });
});

// A colour value may be written only in these files. Every entry says why; keep the list short.
const COLOUR_ALLOWLIST: Record<string, string> = {
  "src/app/brand-tokens.css": "generated from brand/tokens.json: the one place the kit's colours are written",
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
    const retired = /(?<![\w-])(?:bg|text|border|ring|accent|divide|from|to|via|fill|stroke|outline|decoration|caret|placeholder)-(?:navy-soft|navy-deep|success-soft|danger-soft|warning-soft|sand|card|maroon-50|purple-50)(?![\w-])/;
    expect(hits(files, retired)).toEqual([]);
  });

  it("has no module colours: purple, maroon and store green are folded into navy, brown and success", () => {
    const accents = /(?<![\w-])(?:(?:bg|text|border|ring|accent|divide|from|to|via|fill|stroke|outline)-(?:purple|maroon|store)(?:-soft)?|btn-(?:purple|maroon))(?![\w-])/;
    expect(hits(files, accents)).toEqual([]);
  });

  it("has no temporary \"-pending\" token names left, and never draws a control with line-input (1.4:1)", () => {
    expect(hits(SOURCE, /(?<![\w])[a-z-]+-pending(?![\w])/)).toEqual([]);
    expect(hits(files, /line-input/)).toEqual([]);
  });

  it("sets the identifier face (font-mono) only where an identifier is shown or typed", () => {
    const allowed = ["src/app/ops/[eventId]/checkin/checkin-screen.tsx", "src/components/person-picker.tsx"];
    expect(hits(SOURCE.filter((f) => /\.tsx$/.test(f) && !allowed.includes(f)), /(?<![\w-])font-mono(?![\w-])/)).toEqual([]);
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

  it("sets no control shorter than the kit's tap target (48px: min-h-tap-target, min-h-12 or more)", () => {
    expect(hits(ui, /(?<![\w:-])min-h-(?:[1-9]|10|11)(?![\w.-])/)).toEqual([]);
  });

  it("buttons and fields are control-primary tall on a phone and the kit's tap target from tablets up, never shorter", () => {
    const css = read("src/app/globals.css");
    for (const u of ["btn", "field-input"]) {
      expect(css, u).toMatch(new RegExp(`@utility ${u} \\{[^}]*min-height: var\\(--spacing-control-primary\\)`));
      expect(css, u).toMatch(new RegExp(`@utility ${u} \\{[\\s\\S]*?@media \\(min-width: 640px\\) \\{\\s*min-height: var\\(--spacing-tap-target\\)`));
    }
    expect(css).toMatch(/@utility btn \{[^}]*border-radius: var\(--radius-pill\)/);
    expect(css).toMatch(/@utility field-input \{[^}]*border: 1px solid var\(--color-line-control\)/);
    expect(css).toMatch(/@utility field-input \{[^}]*border-radius: var\(--radius-field\)/);
    expect(css).toMatch(/::placeholder \{\s*color: var\(--color-faint\)/);
  });

  it("keeps the badge a kit tag: radius-tag, with the kit's warning pair", () => {
    const ui = read("src/components/ui.tsx");
    expect(ui).toContain("rounded-tag");
    expect(ui).toContain('warning: "bg-warning-50 text-warning-ink border-warning-200"');
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
