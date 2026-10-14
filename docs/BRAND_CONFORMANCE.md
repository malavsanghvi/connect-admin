# Brand conformance: Weaver Admin

Audit of this app (the phone-first event-day app: check-in, kitchen display, day-of tools, plus the console areas still in the code) against
the **Weaver Brand Kit** in connect-crm (`brand/`: `README.md`, `tokens.json`, `logos/`, `icons/`, `components/`). Audited 2026-10-14 against kit version 1
(synced 2026-10-13).

Rules used: Weaver's own chrome (product name, mark, buttons, type, colours of the app itself) follows the kit. A community's own name, logo and
colours stay the community's (`TenantMark`, `centers.branding`). The app is used on phones in poor light, so touch targets stay at 44px or more, contrast
stays at 4.5:1 or more for text, and brand alignment never lowers legibility.

How it stays aligned:

- `brand/tokens.json` is a verbatim copy of the kit's tokens. `scripts/sync-brand-tokens.mjs` (`pnpm brand:sync`) turns it into `src/app/brand-tokens.css`,
  the app's whole Tailwind theme (colours, the two faces and the kit's text styles, radii, shadows, spacing). Tailwind's own palette is switched off.
- `tests/brand-kit.test.ts` fails when the CSS is stale, when a colour value is written outside the token files, when the old colour names or Tailwind's
  default radii come back, when a control is set under 44px, or when the copy says "Community Connect", "bid", uses emoji or exclamation marks.

## Result

| Measure | Before | After |
| --- | --- | --- |
| Colour values written in `.ts`/`.tsx` | 14 (in 5 files) | 0 |
| Colour values in `globals.css` | 29 (a private palette from the older Jain prototype) | 0 (the theme is generated from the kit) |
| Utility classes moved to kit token names (`navy-soft`, `navy-deep`, `success-soft`, `danger-soft`, `warning`, `warning-soft`, `card`, `sand`, page `ground`) | 82 | 0 old names left |
| Tailwind default radii (`rounded`, `-md`, `-lg`, `-xl`, `-2xl`, `-[10px]`) | 73 | 0 (kit `card`, `tile`, `pill`, `chip`, `logo-tile`); 14 `rounded-full` pills and dots kept |
| Buttons set under 44px (`min-h-9`, 36px: retry, remove, reorder) | 9 | 0 |
| Product-name and voice drift in copy (bare "Connect" ×5, emoji ×2, "My Store" ×4, faith word on the sign-in page, page description) | 13 | 0 |
| Faces | Fraunces + DM Sans | Bricolage Grotesque + Hanken Grotesk |
| Allowed colour files | n/a | 4: `brand-tokens.css` (generated), `module-colors.css` (5 module accents, see decision 1), `icon.svg` and `public/brand/weaver-mark.svg` (the official mark) |

## Audit

Status: **Fixed** (changed to match the kit), **Allowed** (differs on purpose, reason given), **Decision** (needs the owner, see below).

### Colour

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Brand colour | `navy` #2b2a8a carries headings, primary buttons, bands | `navy` #1b2c5c (older prototype) | Fixed |
| Primary hover and ink | `navy-hover` #1e1d5c; `ink` #1e1d5c | `navy-deep` #13204a; `ink` #1e1c18 | Fixed |
| Tints | `navy-50` #f1eefc, `saffron-50` #fff1e6, `success-50`, `danger-50` | `navy-soft` #eef1f8, `warning-soft` #fbf1e4, `success-soft`, `danger-soft` #fbeae8 | Fixed |
| Accent text | `brown` #a8400d (6.2:1 on white) | `brown` #8a4608, also named `warning` | Fixed (one token) |
| Page and surfaces | `canvas` page, `white` cards, `ground` quiet, `track` bars | `ground` #fbf7f0 page, `card` white, `sand` #f4efe6 | Fixed |
| Muted text | `muted` #555a79 (6.5:1 on canvas) | `muted` #5e5a52 | Fixed |
| Borders | `line` cards, `line-input` fields | one `line` #e8e0d2 for both | Fixed; see decision 2 |
| Sunrise and gold | `saffron` is a ground, never text; `gold` the one highlight | `saffron` #c9731c defined but unused; tan `#D7A15F` used 6 times for kickers, the active station tab and the "waiting to sync" chip | Fixed (`text-gold` on navy 6.7:1, `bg-gold` with `navy-hover` text 8.8:1) |
| Check-in status on navy | words beside colour; tints `success-50` / `danger-50` | pale green `#9FE0BC` and pink `#F7B4AE` text | Fixed (pills: success 4.6:1 on its tint, danger 5.4:1) |
| Caution badge | no yellow in the kit | `#FBF6DC` / `#6B5A00` | Fixed (`gold` at 30% with `brown-900`, 8.0:1) |
| Selected party row | `navy-100` for selected backgrounds | border `#B8C2DD` | Fixed (`border-navy bg-navy-100`) |
| Ops page background | surfaces are `canvas`, `ground`, `white` | `#EDE6DA` | Fixed (`ground`, cards gain the kit's 1px `line` border) |
| Camera preview background | no black in the kit | `bg-black` | Fixed (`ink`) |
| Browser theme colour | `navy` | `#1B2C5C` | Fixed (read from the kit file) |
| `mark-*` colours | logo only | not used in the interface | Allowed (not emitted into the theme) |
| Module accents purple #5b4b8a, maroon #7a2e1f, store #2f5d50 and two tints | not in the kit | colour the nav dots, kickers, badges, tone buttons | Decision 1 |

### Type

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Display face | Bricolage Grotesque with the optical-size axis, tracked tight | Fraunces (serif) | Fixed (`next/font`, `axes: ["opsz"]`, `-0.01em`) |
| Text face | Hanken Grotesk | DM Sans | Fixed |
| Fallbacks | `ui-sans-serif, system-ui, sans-serif` | `Georgia` serif fallback for display | Fixed (kit stacks) |
| Loading | Google Fonts | `next/font/google`, self-hosted at build | Allowed: same families, served from the app's own origin so event-door wifi needs no third-party request |
| Text styles | `eyebrow` 13px / 700 / 0.08em capitals | kickers `text-xs` tracking-wider (12 places) | Fixed (`text-eyebrow`) |
| Smallest content text | `caption` 14.5px | 12px hints on event-day screens (6 places) | Fixed (`text-caption`) |
| Smallest content text, console | `caption` 14.5px | `text-xs` 12px in 69 console places | Decision 4 |
| Monospace | none | `font-mono` on 3 textareas (date list, audience JSON, markdown) | Allowed: raw-text entry, browser monospace |
| Body size | `body` 16px | `text-sm` 14px in console copy | Allowed: dense screens, contrast passes; see decision 4 |

### Logo, icons, images, manifest

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Mark file | `logos/weaver-mark.svg` exactly | `src/app/icon.svg` byte-identical | Allowed (already right); now test-guarded |
| Favicon, app icon | the same mark | `favicon.ico` and `apple-icon.png` are the mark on white | Allowed (already right) |
| Lockup | mark 44px + "Weaver" in `wordmark` + "Community management platform"; on navy the mark sits on a white tile (`radius-logo-tile`); inside a community's space the community leads and Weaver is small at the foot | none: the name was typed as text "Weaver Admin" | Fixed (`WeaverLogo`: sign-in, setup, not-found, foot of the sidebar and phone menu, foot of the event-day screens). The community's mark and short name still lead the header |
| Community mark tile | white tile, `radius-logo-tile` 12px | `rounded-[10px]` | Fixed |
| Web manifest | name, theme colour, the kit's mark | none | Fixed (`manifest.ts`, kit mark PNGs, `display: browser`); `proxy.ts` leaves it public |
| Share image | not applicable to a signed-in tool | none | Allowed |
| Stray images | none from other brands | five Next.js starter SVGs in `public/` (unused) | Fixed (deleted) |

### Shape, size and states

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Buttons | pills, 52px+, 16px/700; primary `navy`, ghost 2px `navy` at 20%, gold and ghost-on-navy on navy | 8px radius, 44px, 14px/600, 1px line | Fixed (pill, 16px/700, 48px = kit `tap-target`; `btn-primary`, `btn-secondary` = ghost, new `btn-gold`, `btn-ghost-on-navy`). Status and module buttons (success, danger, purple, maroon) keep working on kit colours. 52px: decision 3 |
| Cards | `white`, 1px `line`, `radius-card` 24px, `card-pad` 20/24px | 12px radius, 16/20px padding | Fixed |
| Small cards, rows, notices | `radius-tile` 16px | 8 to 12px | Fixed |
| Chips, tabs, nav items, segment buttons | pill | mixed | Fixed (nav items, station switcher, attendance buttons are pills; code chips `radius-chip`). Underlined page tabs left: decision 7 |
| Form fields | no spec; tap target 48px, `line-input` border | 44px, 8px radius, `line` border | Fixed (48px, `radius-tile`, `line-input`, 16px text); see decision 2 |
| Focus ring | 2px solid `navy`, 2px offset (4px on buttons) | 3px navy at 55% | Fixed; on navy grounds the ring is white (`on-navy`), because a navy ring cannot be seen there |
| Shadows | `shadow-menu` for header drop-downs | `shadow-lg` on the phone menu | Fixed |
| Tap targets | 48px (`tap-target`) | 36px on 9 buttons, 44px elsewhere | Fixed (none under 44px; test-guarded) |
| Page container and gutters | 1160px, 20/32px | 1152px, 16/24px | Decision 8 |
| Kitchen display | large type, status with words | already large; "now serving" white on `success` 5.3:1 | Allowed; cards bordered for the lighter page |

### Icons

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Icon set | 21 stroke icons, 24px grid, decorative, no emoji | no icon set: text glyphs (check, arrows, chevron, multiply, bullet) in labels; two emoji (a lightning bolt) | Emoji fixed; glyphs Decision 6 |

### Voice

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Product name | "Weaver", never "Community Connect" | no "Community Connect"; bare "Connect" for the product in 5 messages (sign-in, flyer, "the Connect app") | Fixed ("Weaver", "the member app") |
| App name | n/a | "Weaver Admin" in the title, sidebar and sign-in | Allowed: names this app; it contains the product name |
| Sentence case | headings and buttons | "My Store" ×4 | Fixed ("My store") |
| No emoji, no exclamation marks | yes | lightning-bolt emoji in "Create action" (summary and a comment) | Fixed; no exclamation marks found |
| "pledge", never "bid" | yes | already clean (one comment states the rule) | Allowed; test-guarded |
| Speak to every organization | no single faith's words in platform copy | sign-in text named Pathshala; page description named Pathshala | Fixed in those two. Module names in the nav (Pathshala, Bolis) are the community's own vocabulary: decision 5 |
| Internal identifiers | n/a | `connect-admin:scan-queue` and `connect-admin:device-id` storage keys | Allowed: not user-facing; renaming would orphan scans queued offline at a door |

## Owner decisions

1. **Module accent colours.** Purple (Pathshala), maroon (events) and green (store), with two tints, are not in the kit. They stay, isolated in `src/app/module-colors.css`.
   *Recommendation:* fold them into the kit's palette (Pathshala `navy`, events `brown`, store `success`) so the app uses one palette, or add "module accents" to the kit. Either way the file goes away or moves into the kit.
2. **Control borders are too faint in the kit.** `line-input` is 1.4:1 on white and `line` 1.26:1; WCAG 1.4.11 asks 3:1 for the edge of a form control. The old app was no better (about 1.3:1), so nothing regressed, and the kit values are used. Fields are 48px with 16px text and a 2px navy focus ring.
   *Recommendation:* add a kit token for control borders at 3:1 or more (for example a mid-tone of `muted`) and use it on inputs, selects and the tick boxes of the check-in rows.
3. **Button height.** The kit's buttons are 52px (56px in the hero); this app's are 48px (`tap-target`) because console rows hold several buttons. Check-in rows and the status buttons are already 56px.
   *Recommendation:* keep 48px in the console and use 52px for the one primary action on each event-day screen.
4. **Small text.** 69 places in the console use 12px (`text-xs`) for hints, table headers and sub-lines, and body copy is 14px. Contrast passes everywhere (4.5:1 or more), but both sit under the kit's smallest content style (`caption`, 14.5px). On event-day screens the 6 such places were raised to `caption`.
   *Recommendation:* raise the console to `caption` and `body-sm` in a separate change, because it changes table density.
5. **Tradition-specific names in the nav.** "Pathshala" and "Bolis" are module names for communities that have those modules; the kit's voice keeps one faith's words out of platform copy.
   *Recommendation:* take module labels from the community's configuration (connect-crm owns the schema); this app only ever shows what that returns.
6. **Icons.** The 21 kit icons are not used; labels carry text glyphs. They are legible and not emoji, so they were left.
   *Recommendation:* when a screen needs a real icon, add one `Icon` component drawn from the kit's SVGs (`currentColor`, `aria-hidden`) and replace the glyphs (check, arrow, chevron, close) in the same change.
7. **Tabs.** The kit says tabs are pills; the console's page tabs are underlined, which is denser on a phone. Left as designed.
8. **Container and gutters.** The console is 1152px wide with 16/24px gutters; the kit's marketing container is 1160px with 20/32px. Left; the event-day screens are narrow and dense by design.
9. **Installable app.** The manifest uses `display: browser`, so "Add to Home Screen" stays a plain shortcut, as before. `standalone` would hide the address bar.
   *Recommendation:* switch to `standalone` only once the event-day screens work offline end to end (the scan queue already survives a dropped connection).

## What this audit could not check

No browser pass over signed-in screens (the app needs a Supabase session). In a browser: the sign-in page and a throw-away page rendering the shared components (cards, badges, notices, buttons, fields, sidebar, the check-in status strip and station tabs, the kitchen panels) at phone and desktop width. Not checked: the camera scanner, the offline queue states, real data in the tables, and keyboard focus rings on navy.
