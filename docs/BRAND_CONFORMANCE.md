# Brand conformance: Weaver Admin

Audit of this app (the phone-first event-day app: check-in, kitchen display, day-of tools, plus the console areas still in the code) against
the **Weaver Brand Kit** in connect-crm (`brand/`: `README.md`, `tokens.json`, `logos/`, `icons/`, `components/`). Audited 2026-10-14 against kit version 2
(connect-crm commit 2b758c1f, synced 2026-10-14). The owner's decisions of 2026-10-14 ("go with your recommendations") are applied and listed below, and the
tokens the kit added for them are vendored: nothing in this app is waiting on the kit.

Rules used: Weaver's own chrome (product name, mark, buttons, type, colours of the app itself) follows the kit. A community's own name, logo and
colours stay the community's (`TenantMark`, `centers.branding`). The app is used on phones in poor light, so touch targets stay at the kit's 48px or more,
contrast stays at 4.5:1 or more for text, and brand alignment never lowers legibility.

How it stays aligned:

- `brand/tokens.json` and `brand/icons/*.svg` are a verbatim copy of the kit's. `scripts/sync-brand-tokens.mjs` (`pnpm brand:sync`) turns them into
  `src/app/brand-tokens.css` (the app's whole Tailwind theme: colours, the three faces and the kit's text styles, radii, shadows, spacing and control sizes) and
  `src/components/brand-icons.generated.ts` (the `Icon` component's shapes). Tailwind's own palette is switched off.
- `tests/brand-kit.test.ts` fails when a generated file is stale, when a colour value is written outside the token files, when the old colour names, module
  colours, `line-input` on a control or temporary names come back, when Tailwind's default radii return, when a control is shorter than 48px, when 12px text appears
  outside the compact chips, when the identifier face is used for anything but identifiers, when a kit contrast claim stops holding, or when the copy says
  "Community Connect", "bid", uses emoji or exclamation marks. `tests/labels.test.ts` covers the community-configured module names.

## Result

| Measure | Before | After |
| --- | --- | --- |
| Colour values written in `.ts`/`.tsx` | 14 (in 5 files) | 0 |
| Colour values in `globals.css` | 29 (a private palette from the older Jain prototype) | 0 (the theme is generated from the kit) |
| Module colours (purple, maroon, store green and two tints) | 5 values, used in 80+ places | 0: folded into navy, brown and success |
| Utility classes moved to kit token names (`navy-soft`, `navy-deep`, `success-soft`, `danger-soft`, `warning`, `warning-soft`, `card`, `sand`, page `ground`) | 82 | 0 old names left |
| Tailwind default radii (`rounded`, `-md`, `-lg`, `-xl`, `-2xl`, `-[10px]`) | 73 | 0 (kit `card`, `tile`, `pill`, `chip`, `logo-tile`, `field`, `tag`); 14 `rounded-full` pills and dots kept |
| Controls under the kit's tap target (36px buttons ×9, 44px `min-h-11` ×28, a 36px remove button) | 38 | 0: buttons 52px on a phone, 48px from tablets up; everything else tapped 48px |
| 12px text (`text-xs`) | 75 places | 6 compact chips; 63 moved to the kit's caption (14.5px), 3 label styles to the kit's eyebrow (13px) |
| Text glyphs standing in for icons | 9 places | 0: the kit's check, close, arrow, chevron and alert icons (42 vendored, one `Icon` component) |
| Product-name and voice drift in copy (bare "Connect" ×5, emoji ×2, "My Store" ×4, faith word on the sign-in page, page description) | 13 | 0 |
| Faith words in navigation labels (section "Pathshala", "Gyan Path sign-offs", "Bolis") | 3 in code | 0: names come from the community's kind (`app.category_profile`) or are neutral |
| Faces | Fraunces + DM Sans | Bricolage Grotesque + Hanken Grotesk + JetBrains Mono (identifiers only) |
| Allowed colour files | n/a | 3: `brand-tokens.css` (generated), `icon.svg` and `public/brand/weaver-mark.svg` (the official mark) |

## Audit

Status: **Fixed** (changed to match the kit) or **Allowed** (differs on purpose, reason given).

### Colour

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Brand colour | `navy` #2b2a8a carries headings, primary buttons, bands | `navy` #1b2c5c (older prototype) | Fixed |
| Primary hover and ink | `navy-hover` #1e1d5c; `ink` #1e1d5c | `navy-deep` #13204a; `ink` #1e1c18 | Fixed |
| Tints | `navy-50`, `saffron-50`, `success-50`, `danger-50` | `navy-soft`, `warning-soft`, `success-soft`, `danger-soft` #fbeae8 | Fixed |
| Accent text | `brown` #a8400d (6.2:1 on white) | `brown` #8a4608, also named `warning` | Fixed (one token) |
| Page and surfaces | `canvas` page, `white` cards, `ground` quiet, `track` bars | `ground` #fbf7f0 page, `card` white, `sand` #f4efe6 | Fixed |
| Muted and faint text | `muted` (6.5:1) for support text; `faint` #666b86 (5.2:1) for placeholders and tertiary text | `muted` #5e5a52; placeholders half-transparent text colour | Fixed. Placeholders use `faint`; hints and captions stay `muted` (higher contrast than `faint`: legibility first) |
| Borders | `line` cards and dividers; `line-control` #85889e (3.5:1) on every real control; `line-input` never on a control | one `line` #e8e0d2 for everything, about 1.3:1 | Fixed: every field, select and textarea, and the selectable rows and buttons (audience options, attendance status, vote options, check-in row and tick box) use `line-control` |
| Warning | `warning-50` fill, 1px `warning-200` border, `warning` icon, `warning-ink` text (5.5 to 8.6:1) | `saffron-50` with `brown` | Fixed: `Badge` and `Notice` warning tones, the check-in, walk-in and kitchen warnings, the RSVP flags line; `Notice` gains the kit's alert icon |
| Strong accent for white text | `saffron-strong` #c2501c (4.7:1) | n/a | Allowed: unused; every white-text fill already passes with `navy`, `brown`, `success` or `danger` |
| Sunrise and gold | `saffron` is a ground, never text; `gold` the one highlight | `saffron` #c9731c defined but unused; tan `#D7A15F` used 6 times for kickers, the active station tab and the "waiting to sync" chip | Fixed (`text-gold` on navy 6.7:1, `bg-gold` with `navy-hover` text 8.8:1) |
| Check-in status on navy | words beside colour; tints `success-50` / `danger-50` | pale green `#9FE0BC` and pink `#F7B4AE` text | Fixed (pills: success 4.6:1 on its tint, danger 5.4:1) |
| Caution badge | no yellow in the kit | `#FBF6DC` / `#6B5A00` | Fixed (`gold` at 30% with `brown-900`, 8.0:1) |
| Selected party row | `navy-100` for selected backgrounds | border `#B8C2DD` | Fixed (`border-navy bg-navy-100`) |
| Ops page background | surfaces are `canvas`, `ground`, `white` | `#EDE6DA` | Fixed (`ground`, cards gain the kit's 1px `line` border) |
| Camera preview background | no black in the kit | `bg-black` | Fixed (`ink`) |
| Browser theme colour | `navy` | `#1B2C5C` | Fixed (read from the kit file) |
| `mark-*` colours | logo only | not used in the interface | Allowed (not emitted into the theme) |
| Module colours: purple (Pathshala), maroon (events), store green, two tints | not in the kit | colour-coded nav dots, kickers, badges, stat numbers, tone buttons | Fixed (owner decision): see below |

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
| Identifier face | JetBrains Mono, `identifier` style 13.5px / 500, for identifiers only (numbers, codes), never running text | the browser's monospace on 3 raw-text fields | Fixed: `font-mono` on the check-in ticket / member number field (kept at 18px to read at a door) and `text-identifier` on member and household numbers in the pickers. The 3 raw-text fields (date list, audience JSON, markdown) are not identifiers and are back in Hanken Grotesk |
| Fallbacks | `ui-sans-serif, system-ui, sans-serif` | `Georgia` serif fallback for display | Fixed (kit stacks) |
| Loading | Google Fonts | `next/font/google`, self-hosted at build | Allowed: same families, served from the app's own origin so event-door wifi needs no third-party request |
| Kickers and uppercase labels | `eyebrow` 13px / 700 / 0.08em capitals | `text-xs` tracking-wider (12px) in 12 kickers, table headers, stat labels and definition lists | Fixed (`text-eyebrow`) |
| Hints, sub-lines and fine print | `caption` 14.5px, the smallest running text on a touch surface | 12px (`text-xs`) in 63 places, 6 of them on event-day screens | Fixed (`text-caption`) |
| Compact chips | tags 11 to 12px bold, in words | `Badge`, the count in a tab, the inbox counters and the setup status pills stay 12px semibold | Allowed: each carries a word or number inside a tag in dense tables and lists; 4.5:1 or more; a test limits 12px to those files |
| Body size | `body` 16px | `text-sm` 14px in console copy | Allowed: dense screens, contrast passes |

### Logo, icons, images, manifest

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Mark file | `logos/weaver-mark.svg` exactly | `src/app/icon.svg` byte-identical | Allowed (already right); now test-guarded |
| Favicon, app icon | the same mark | `favicon.ico` and `apple-icon.png` are the mark on white | Allowed (already right) |
| Lockup | mark 44px + "Weaver" in `wordmark` + "Community management platform"; on navy the mark sits on a white tile (`radius-logo-tile`); inside a community's space the community leads and Weaver is small at the foot | none: the name was typed as text "Weaver Admin" | Fixed (`WeaverLogo`: sign-in, setup, not-found, foot of the sidebar and phone menu, foot of the event-day screens). The community's mark and short name still lead the header |
| Community mark tile | white tile, `radius-logo-tile` 12px | `rounded-[10px]` | Fixed |
| Icons | 42 stroke icons, 24px grid, drawn in the text colour, decorative | none: text glyphs | Fixed: `brand/icons` vendored, `Icon` generated from it. Ticks (buttons, saved messages, attendance, the check-in tick box), the remove button, the back arrow, the open/closed chevron and the warning alert use it. Left as text: the ● status dots, arrows inside a date range, "×" meaning times and "›" in a path of menu names |
| Web manifest | name, theme colour, the kit's mark | none | Fixed (`manifest.ts`, kit mark PNGs, `display: browser`); `proxy.ts` leaves it public |
| Share image | not applicable to a signed-in tool | none | Allowed |
| Stray images | none from other brands | five Next.js starter SVGs in `public/` (unused) | Fixed (deleted) |

### Shape, size and states

| Item | Kit says | App did | Status |
| --- | --- | --- | --- |
| Buttons | pills, 16px/700; primary `navy`, ghost 2px `navy` at 20%, gold and ghost-on-navy on navy | 8px radius, 44px, 14px/600, 1px line | Fixed (`btn-primary`, `btn-secondary` = ghost, `btn-gold`, `btn-ghost-on-navy`). Success and danger buttons keep working on kit colours |
| Button height | `control-primary` 52px: every button on a phone; `tap-target` 48px least on touch; compact 40 and dense 36 are mouse-only | 44px, 36px on 9 buttons | Fixed: 52px below 640px, 48px from there up; no compact or dense size, because the event-day app is a touch app. The one primary action of each event-day screen is 56px |
| Fields | white, 1px `line-control`, `radius-field` 12px, 16px text, `faint` placeholder, `canvas` fill when disabled; 52px on a phone, 48px least | 44px, 8px radius, faint border | Fixed |
| Cards | `white`, 1px `line`, `radius-card` 24px, `card-pad` 20/24px | 12px radius, 16/20px padding | Fixed |
| Small cards, rows, notices | `radius-tile` 16px | 8 to 12px | Fixed |
| Status tags | `radius-tag` 8px, words, tint or solid | pills | Fixed (`Badge` and the tab counts) |
| Chips, tabs, nav items, segment buttons | pill | mixed | Fixed (nav items, station switcher, attendance buttons are pills; code chips `radius-chip`). Underlined page tabs left: a denser tab on a phone; revisit with the portal's tabs |
| Focus ring | 2px solid `navy`, 2px offset (4px on buttons) | 3px navy at 55% | Fixed; on navy grounds the ring is white (`on-navy`), because a navy ring cannot be seen there |
| Shadows | `shadow-menu` for header drop-downs | `shadow-lg` on the phone menu | Fixed |
| Tap targets | 48px (`tap-target`) on every touch surface | 36px on 9 buttons and a remove button, 44px elsewhere (28 places) | Fixed (none under 48px; test-guarded) |
| Page container and gutters | 1160px, 20/32px | 1152px, 16/24px | Allowed: the event-day screens are narrow and dense by design |
| Kitchen display | large type, status with words | already large; "now serving" white on `success` 5.3:1 | Allowed; cards bordered for the lighter page |

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
2. **Control borders** use the kit's `line-control` (3.5:1); `line-input` is never used on a control (test-guarded).
3. **Button height:** the kit's `control-primary` (52px) on a phone and `tap-target` (48px) from tablets up; the one primary action of each event-day screen is 56px.
4. **Small text:** the console moved to the kit's caption size; 12px stays only on compact word-bearing chips (documented above, test-guarded).
5. **Faith words in navigation** replaced by the community's own labels, or neutral wording.
6. **Icons:** the kit's 42 icons are vendored and used in place of the text glyphs that acted as icons. Tabs, container and the installable app are left as they are, with the reasons
   above (the manifest is `display: browser`, so "Add to Home Screen" stays a plain shortcut; `standalone` only once the event-day screens work offline end to end).

## Kit v2 applied (what was temporary is now the kit's)

The temporary `-pending` names used while the kit was being extended are gone (`src/app/pending-kit-tokens.css` is deleted, and a test fails if one returns):

| Temporary name | Kit token now |
| --- | --- |
| `control-border-pending` (#878ba8) | `line-control` #85889e |
| `warning-tint-pending`, `warning-ink-pending` | `warning-50`, `warning-ink` (and `warning-200` for the border, `warning` for the icon) |
| `radius-field-pending`, `radius-tag-pending` | `radius-field` (12px), `radius-tag` (8px) |
| `font-mono-pending` | `font-mono` = JetBrains Mono, with the `identifier` text style; the generator emits it from `type.families.mono` |

The kit's `saffron-strong` has no use in this app, and `faint` is used for placeholders only (see Colour).

## What this audit could not check

No browser pass over signed-in screens (the app needs a Supabase session). In a browser: the sign-in page and throw-away pages rendering the shared components (cards, badges, notices with the alert icon, buttons and fields at phone width, the sidebar with two kinds' labels, the check-in status strip and station tabs, the kitchen panels, the identifier face) at phone and desktop width. Not checked: the camera scanner, the offline queue states, real data in the tables, the `category_profile` answer for a real community (the label logic is unit-tested against the contract's shape), and keyboard focus rings on navy.
