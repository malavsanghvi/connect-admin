# Vendored Weaver Brand Kit files

The Weaver Brand Kit lives in connect-crm (`brand/`: the brand book, `tokens.json`, logos, icons and component guides). This folder holds a
verbatim copy of what this app builds from:

| File | Copy of | Used by |
| --- | --- | --- |
| `tokens.json` | connect-crm `brand/tokens.json` (kit version 2, connect-crm commit 2b758c1f, synced 2026-10-14) | `scripts/sync-brand-tokens.mjs` writes `src/app/brand-tokens.css` from it; `src/lib/brand-kit.ts` reads colours from it |
| `icons/` (42 SVGs and a README) | connect-crm `brand/icons/` | the script writes `src/components/brand-icons.generated.ts` from them, for the `Icon` component |
| `../public/brand/weaver-mark.svg` (and `../src/app/icon.svg`, the same file) | connect-crm `brand/logos/weaver-mark.svg` | the logo lockup, the favicon, the web manifest |
| `../public/brand/weaver-mark-256.png`, `weaver-mark-512.png` | connect-crm `brand/logos/` | the web manifest icons |

Never edit these by hand. To take a new version of the kit:

```bash
node scripts/sync-brand-tokens.mjs --from ../connect-crm/brand   # copies the files above, then regenerates the CSS and the icons
```

`tests/brand-kit.test.ts` fails when `src/app/brand-tokens.css` and `tokens.json` (or the icons file and `icons/`) disagree, when the two copies of the mark differ, or when a colour
value appears outside `src/app/brand-tokens.css` and the short commented allowlist in that test. The audit is in `docs/BRAND_CONFORMANCE.md`.
