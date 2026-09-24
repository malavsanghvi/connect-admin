@AGENTS.md

## Project context

Connect Admin is the operations console of the Connect platform (tenant #1: Jain Society of
Houston). Priorities, in order: **Pathshala** (classes, rosters, attendance, Gyan Path sign-offs,
the committee / EAMS replacement) and **events** (RSVPs, checklists, phone-first check-in, lunch
slots, kitchen display). Bolis, store, content, communications and volunteers follow.

- **The schema is owned by `connect-crm`** (`../connect-crm/supabase/migrations`). Never change it
  here. `src/lib/database.types.ts` is generated there — copy the regenerated file over, never edit it
  by hand. If the app needs something the schema lacks, record it as a schema gap for connect-crm.
- Supabase client uses `db: { schema: 'app' }`. Business rules that must hold for every app go
  through RPCs (`check_in`, `create_event_from_template`, `close_boli`, `boli_summary`,
  `approve_as_second`, …), not client re-implementations.
- **Access**: `src/lib/access.ts` mirrors `app.has_permission` (center-wide grants only) and
  `app.has_scoped_role` (teacher → class, event_lead / checkin_volunteer / boli_recorder /
  kitchen_lead → event, zone_lead → zone). Nav hides what a user can't use, pages render
  `<NoAccess>` instead of empty tables, and every Server Action re-checks — RLS still decides.
- Next.js 16: `proxy.ts` (not middleware), async `params` / `searchParams` / `cookies()`,
  `refresh()` from `next/cache` after mutations, error boundaries get `retry`.
- Money is integer cents; format only at the edge (`src/lib/format.ts`).
- Bolis take **pledges** — never write "bid" anywhere in the UI.

## Error-surfacing rule (non-negotiable)

Every failure the user triggered is shown to them **in plain English, beside the control, with a
retry** — never console-only, never a silent fallback. Server Actions return `{ ok, error }`
(`src/lib/result.ts`); wrap bodies in `runAction()` and DB calls in `must()` (`src/lib/forms.ts`),
which log the technical detail server-side and translate it with `friendlyError()`. Use
`<ActionForm>` / `<ActionButton>` (`src/components/action-form.tsx`) so the error + "Try again"
render next to the button. Page loads use `load()` + `rows()` / `row()` (`src/lib/session.ts`) and
render `<LoadProblem>` with a retry on failure.

## Checks before handing off

`pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build` (with dummy
`NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy`).

## Handover and memory (read at session start)
- Handover receipt (every handoff file, memory line and feature → where it is built): `../connect-crm/docs/HANDOVER_RECEIPT.md` (GitHub: malavsanghvi/connect-crm, `docs/HANDOVER_RECEIPT.md`)
- Project memory from the claude.ai prototyping sessions: `connect-crm/docs/handoff/project-memory.md`
- Decisions and open questions: `connect-crm/docs/DECISIONS.md` · design-doc export: `connect-crm/docs/design-doc/`
- Prototypes (reference only, never shipped): `connect-crm/docs/handoff/prototypes/source/AdminPortal.dc.html`, `Volunteer.dc.html`
- Rules from the founder: bolis say "pledge", never "bid"; money is integer cents; names are never enough to identify a household — always show the household card.
