# Brand conformance: Weaver Admin

Audit of this app (the phone-first event-day app: check-in, kitchen display, day-of tools, plus the console areas still in the code) against
the **Weaver Brand Kit** in connect-crm (`brand/`: `README.md`, `tokens.json`, `logos/`, `icons/`, `components/`). Audited 2026-10-14 against kit version 1
(synced 2026-10-13). The owner's decisions of 2026-10-14 ("go with your recommendations") are applied and listed below.

Rules used: Weaver's own chrome (product name, mark, buttons, type, colours of the app itself) follows the kit. A community's own name, logo and
colours stay the community's (`TenantMark`, `centers.branding`). The app is used on phones in poor light, so touch targets stay at 44px or more, contrast
stays at 4.5:1 or more for text, and brand alignment never lowers legibility.

How it stays aligned:

- `brand/tokens.json` is a verbatim copy of the kit's tokens. `scripts/sync-brand-tokens.mjs` (`pnpm brand:sync`) turns it into `src/app/brand-tokens.css`,
  the app's whole Tailwind theme (colours, the two faces and the kit's text styles, radii, shadows, spacing). Tailwind's own palette is switched off.
- `tests/brand-kit.test.ts` fails when the CSS is stale, when a colour value is written outside the token files, when the old colour names, module colours or
  Tailwind's default radii come back, when a control is set under 44px, when 12px text appears outside the compact chips, or when the copy says
  "Community Connect", "bid", uses emoji or exclamation marks. `tests/labels.test.ts` covers the community-configured module names.

## Result

| Measure | Before | After |
| --- | --- | --- |
| Colour values written in `.ts`/`.tsx` | 14 (in 5 files) | 0 |
| Colour values in `globals.css` | 29 (a private palette from the older Jain prototype) | 0 (the theme is generated from the kit) |
| Module colours (purple, maroon, store green and two tints) | 5 values, used in 80+ places | 0: folded into navy, brown and success |
| Utility classes moved to kit token names (`navy-soft`, `navy-deep`, `success-soft`, `danger-soft`, `warning`, `warning-soft`, `card`, `sand`, page `ground`) | 82 | 0 old names left |
| Tailwind default radii (`rounded`, `-md`, `-lg`, `-xl`, `-2xl`, `-[10px]`) | 73 | 0 (kit `card`, `tile`, `pill`, `chip`, `logo-tile`); 14 `rounded-full` pills and dots kept |
| Buttons set under 44px (`min-h-9`, 36px: retry, remove, reorder) | 9 | 0 |
| 12px text (`text-xs`) | 75 places | 6 compact chips (see Type); 63 moved to the kit's caption (14.5px), 3 label styles to the kit's eyebrow (13px) |
| Product-name and voice drift in copy (bare "Connect" ×5, emoji ×2, "My Store" ×4, faith word on the sign-in page, page description) | 13 | 0 |
| Faith words in navigation labels (section "Pathshala", "Gyan Path sign-offs", "Bolis") | 3 in code | 0: names come from the community's kind (`app.category_profile`) or are neutral |
| Faces | Fraunces + DM Sans | Bricolage Grotesque + Hanken Grotesk (+ JetBrains Mono for identifiers, under a temporary name) |
| Allowed colour files | n/a | 4: `brand-tokens.css` (generated), `pending-kit-tokens.css` (one temporary colour, see "Waiting on the kit"), `icon.svg` and `public/brand/weaver-mark.svg` (the official mark) |

## Audit

Status: **Fixed** (changed to match the kit), **Allowed** (differs on purpose, reason given), **Waiting** (needs a token the kit is adding).

### Colour

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Brand colour | `navy` #2b2a8a carries headings, primary buttons, bands | `navy` #1b2c5c (older prototype) | Fixed |
| Primary hover and ink | `navy-hover` #1e1d5c; `ink` #1e1d5c | `navy-deep` #13204a; `ink` #1e1c18 | Fixed |
| Tints | `navy-50` #f1eefc, `saffron-50` #fff1e6, `success-50`, `danger-50` | `navy-soft` #eef1f8, `warning-soft` #fbf1e4, `success-soft`, `danger-soft` #fbeae8 | Fixed |
| Accent text | `brown` #a8400d (6.2:1 on white) | `brown` #8a4608, also named `warning` | Fixed (one token) |
| Page and surfaces | `canvas` page, `white` cards, `ground` quiet, `track` bars | `ground` #fbf7f0 page, `card` white, `sand` #f4efe6 | Fixed |
| Muted text | `muted` #555a79 (6.5:1 on canvas) | `muted` #5e5a52 | Fixed |
| Borders | `line` cards and dividers | one `line` #e8e0d2 for everything | Fixed; control borders Waiting |
| Sunrise and gold | `saffron` is a ground, never text; `gold` the one highlight | `saffron` #c9731c defined but unused; tan `#D7A15F` used 6 times for kickers, the active station tab and the "waiting to sync" chip | Fixed (`text-gold` on navy 6.7:1, `bg-gold` with `navy-hover` text 8.8:1) |
| Check-in status on navy | words beside colour; tints `success-50` / `danger-50` | pale green `#9FE0BC` and pink `#F7B4AE` text | Fixed (pills: success 4.6:1 on its tint, danger 5.4:1) |
| Caution badge | no yellow in the kit | `#FBF6DC` / `#6B5A00` | Fixed (`gold` at 30% with `brown-900`, 8.0:1) |
| Selected party row | `navy-100` for selected backgrounds | border `#B8C2DD` | Fixed (`border-navy bg-navy-100`) |
| Ops page background | surfaces are `canvas`, `ground`, `white` | `#EDE6DA` | Fixed (`ground`, cards gain the kit's 1px `line` border) |
| Camera preview background | no black in the kit | `bg-black` | Fixed (`ink`) |
| Browser theme colour | `navy` | `#1B2C5C` | Fixed (read from the kit file) |
| `mark-*` colours | logo only | not used in the interface | Allowed (not emitted into the theme) |
| Module colours: purple (Pathshala), maroon (events), store green, two tints | not in the kit | colour-coded nav dots, kickers, badges, stat numbers, tone buttons | Fixed (owner decision): see "Module colours" below |
| Warning tint and ink | the kit is adding a pair | `saffron-50` with `brown` | Waiting (`warning-tint-pending`, `warning-ink-pending`, aliases of those two) |

### Module colours (folded; words and icons carry meaning)

| Was | Now |
| --- | --- |
| Pathshala purple: kickers, tabs, selected pills, buttons, badges, stat numbers | `navy` (text, selected pills) and `btn-primary` (every module's action button is the kit's primary button) |
| Events maroon: kickers, stat numbers, buttons, selected filter pills | `brown` for kicker and stat text (the kit's eyebrow colour); `navy` fills for buttons and selected pills; unselected pills `navy` text |
| Store green text | `success` |
| Maroon badge (high-priority action, "Voting open") | `warning` tone |
| Purple badge | `navy` tone |
| Navigation dots in section headings | removed (the section name says it) |

### Type

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Display face | Bricolage Grotesque with the optical-size axis, tracked tight | Fraunces (serif) | Fixed (`next/font`, `axes: ["opsz"]`, `-0.01em`) |
| Text face | Hanken Grotesk | DM Sans | Fixed |
| Fallbacks | `ui-sans-serif, system-ui, sans-serif` | `Georgia` serif fallback for display | Fixed (kit stacks) |
| Loading | Google Fonts | `next/font/google`, self-hosted at build | Allowed: same families, served from the app's own origin so event-door wifi needs no third-party request |
| Kickers and uppercase labels | `eyebrow` 13px / 700 / 0.08em capitals | `text-xs` tracking-wider (12px) in 12 kickers, table headers, stat labels and definition lists | Fixed (`text-eyebrow`) |
| Hints, sub-lines and fine print | `caption` 14.5px | 12px (`text-xs`) in 63 places, 6 of them on event-day screens | Fixed (`text-caption`) |
| Compact chips | no 12px style | `Badge`, the count in a tab, the inbox counters and the setup status pills stay 12px semibold | Allowed: each carries a word or number inside a pill in dense tables and lists; 4.5:1 or more; a test limits 12px to those files |
| Identifiers | JetBrains Mono (being added) | none: the browser's monospace on 3 raw-text fields | Waiting (`font-mono-pending`: the 3 raw-text fields and the check-in ticket / member number field) |
| Body size | `body` 16px | `text-sm` 14px in console copy | Allowed: dense screens, contrast passes |

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
| Buttons | pills, 52px+, 16px/700; primary `navy`, ghost 2px `navy` at 20%, gold and ghost-on-navy on navy | 8px radius, 44px, 14px/600, 1px line | Fixed (pill, 16px/700, 48px = kit `tap-target`; `btn-primary`, `btn-secondary` = ghost, `btn-gold`, `btn-ghost-on-navy`). Success and danger buttons keep working on kit colours |
| Button height | 52px (56px in the hero) | 48px | Allowed: console rows hold several buttons, and 48px is the kit's own tap target. The one primary action of each event-day screen (check-in confirm, walk-in, "Start serving") is 56px |
| Cards | `white`, 1px `line`, `radius-card` 24px, `card-pad` 20/24px | 12px radius, 16/20px padding | Fixed |
| Small cards, rows, notices | `radius-tile` 16px | 8 to 12px | Fixed |
| Chips, tabs, nav items, segment buttons | pill | mixed | Fixed (nav items, station switcher, attendance buttons are pills; code chips `radius-chip`). Underlined page tabs left: a denser tab on a phone; revisit with the portal's tabs |
| Form fields | tap target 48px | 44px, 8px radius, faint border | Fixed (48px, 16px text); border and radius Waiting (`control-border-pending`, `radius-field-pending`) |
| Status chips | the kit is adding `radius-tag` | pills | Waiting (`radius-tag-pending`, an alias of the pill radius, on `Badge` and the tab counts) |
| Focus ring | 2px solid `navy`, 2px offset (4px on buttons) | 3px navy at 55% | Fixed; on navy grounds the ring is white (`on-navy`), because a navy ring cannot be seen there |
| Shadows | `shadow-menu` for header drop-downs | `shadow-lg` on the phone menu | Fixed |
| Tap targets | 48px (`tap-target`) | 36px on 9 buttons, 44px elsewhere | Fixed (none under 44px; test-guarded) |
| Page container and gutters | 1160px, 20/32px | 1152px, 16/24px | Allowed: the event-day screens are narrow and dense by design |
| Kitchen display | large type, status with words | already large; "now serving" white on `success` 5.3:1 | Allowed; cards bordered for the lighter page |

### Icons

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Icon set | 21 stroke icons, 24px grid, decorative, no emoji | no icon set: text glyphs (check, arrows, chevron, multiply, bullet) in labels; two emoji (a lightning bolt) | Emoji fixed. Glyphs Allowed: legible, not emoji. When a screen needs a real icon, add one `Icon` component drawn from the kit's SVGs (`currentColor`, `aria-hidden`) and replace the glyphs in the same change |

### Voice

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Product name | "Weaver", never "Community Connect" | no "Community Connect"; bare "Connect" for the product in 5 messages (sign-in, flyer, "the Connect app") | Fixed ("Weaver", "the member app") |
| App name | n/a | "Weaver Admin" in the title, sidebar and sign-in | Allowed: names this app; it contains the product name |
| Sentence case | headings and buttons | "My Store" ×4 | Fixed ("My store" in code; the store's own name comes from the community's kind) |
| No emoji, no exclamation marks | yes | lightning-bolt emoji in "Create action" (summary and a comment) | Fixed; no exclamation marks found |
| "pledge", never "bid" | yes | already clean (one comment states the rule) | Allowed; test-guarded |
| Speak to every organization | no single faith's words in platform copy | nav section "Pathshala", "Gyan Path sign-offs" and "Bolis" in code; sign-in text and page description named Pathshala | Fixed: see "Module names" below |
| Internal identifiers | n/a | `connect-admin:scan-queue` and `connect-admin:device-id` storage keys | Allowed: not user-facing; renaming would orphan scans queued offline at a door |

### Module names (community-configured)

The navigation and the headings that repeat it take their words from the community's kind, the way connect-crm does (`src/lib/kind.ts`, `kindName`): `getViewer`
asks `app.category_profile` once per request, `src/lib/labels.ts` turns the answer into the school, sign-offs, pledge-event and store names, and `buildNav` uses
them. A kind that offers the module and has not renamed it keeps the catalog's own name; a kind that does not offer it, or a lookup that fails (logged), gets neutral
wording ("Learning", "Sign-offs", "Event pledges", "Store"). Only words change; who sees which area is still decided by roles and the database.

Neutral wording replaced the module name where it sits in prose or in a tab title (tab titles are static): "No term yet", "All families this term", "school year",
"Only the principal can ...", "parents by class". Still in the module's own vocabulary, because they are inside screens of a module a community chose to have: the Bolis
list, form and detail screens (about 40 strings, such as "New boli"), and the messages of the Pathshala and Bolis server actions (about 30). Recommended next step:
pass the labels into those screens in a follow-up; the nav item that leads to them already carries the community's name.

## Owner decisions, applied (2026-10-14: "go with your recommendations")

1. **Module accents** folded into navy, brown and success (table above); `module-colors.css` is deleted.
2. **Control borders** use a temporary 3:1 token until the kit's arrives (see below).
3. **Button height:** 48px kept; the one primary action of each event-day screen is 56px.
4. **Small text:** the console moved to the kit's caption size; 12px stays only on compact word-bearing chips (documented above, test-guarded).
5. **Faith words in navigation** replaced by the community's own labels, or neutral wording.
6. **Icons, tabs, container, installable app:** left as they are, with the reasons above (the manifest is `display: browser`, so "Add to Home Screen" stays a plain
   shortcut; `standalone` only once the event-day screens work offline end to end).

## Waiting on the kit

The portal builder is adding these to connect-crm `brand/tokens.json`. Until the final token table arrives they are used under clearly temporary names from
`src/app/pending-kit-tokens.css` (every name ends in `-pending`, the file says `TODO(kit)`, and a test keeps it that way):

| Kit addition | Temporary name | Used on |
| --- | --- | --- |
| Control border at 3:1 | `control-border-pending` (#878ba8: 3.3:1 on white, 3.2:1 on canvas; the file's only colour value) | `field-input` (every input, select, textarea); the selectable rows and buttons: audience options, attendance status (off), vote options, check-in party row and tick box |
| Warning tint and ink | `warning-tint-pending`, `warning-ink-pending` (aliases of `saffron-50`, `brown`) | `Badge` and `Notice` warning tones, the check-in, walk-in and kitchen warnings, the RSVP flags line |
| `radius-field`, `radius-tag` | `radius-field-pending`, `radius-tag-pending` (aliases of the tile and pill radii) | `field-input`; `Badge` and the tab counts |
| JetBrains Mono for identifiers | `font-mono-pending` (loaded with `next/font`) | the check-in ticket / member number field and the 3 raw-text fields |
| A strong accent for white-text fills at 4.5:1 | none needed | every white-text fill already passes with kit colours (`brown` 6.2:1, `success` 5.3:1, `danger` 6.5:1, `navy` 11.7:1) |
| Faint text at 4.5:1 | none needed | the app uses `muted` (6.5:1) for its quietest text |

When the table arrives: re-vendor `brand/tokens.json` verbatim, map each `-pending` class to the kit's name, remove the temporaries and the allowlist entry,
and teach the generator any new family (`FONT_VARIABLES`).

## What this audit could not check

No browser pass over signed-in screens (the app needs a Supabase session). In a browser: the sign-in page and a throw-away page rendering the shared components (cards, badges, notices, buttons, fields, sidebar with two kinds' labels, the check-in status strip and station tabs, the kitchen panels, the mono field) at phone and desktop width. Not checked: the camera scanner, the offline queue states, real data in the tables, the `category_profile` answer for a real community (the label logic is unit-tested against the contract's shape), and keyboard focus rings on navy.
