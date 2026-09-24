# Connect Admin

> **Scope (owner decision 2026-09-24): the event-day app only, for now.** Community Connect is
> **connect-crm** (the admin portal for everything an organization manages) and
> **connect-mobile** (the app for all members). This app is used only on event day — check-in,
> the kitchen display, the day-of view — and grows only after those two have matured. New
> features go to connect-crm or connect-mobile, not here. The other areas described below still
> exist in the code but are managed in connect-crm.

The operations console of the **Connect** community platform — used by the people who run
programs, not by members. Jain Society of Houston (JSH) is tenant #1.

| Who | What they do here |
|---|---|
| Pathshala principal and committee | Terms, classes, teacher assignments, enrollment placement and waitlists, announcements, the committee dashboard (actions, templates, "create year", concerns, resolutions) |
| Teachers | **My classes** → phone-friendly attendance (Present / Late / Absent / Excused, rotating class QR), Gyan Path sign-offs, class announcements |
| Event leads | Event setup (RSVP window, flags, commitments, lunch slots), checklists, RSVPs, volunteer shifts, lunch "now serving", day-of report |
| Check-in volunteers | `/ops/<event>/checkin` — station switcher (Entry / Food / Gifts), camera or keyboard-wedge scanner, member cards and legacy QR codes, walk-ins by phone, offline queue |
| Kitchen lead | `/ops/<event>/kitchen` — large headcount-by-slot display and store orders due |
| Religious coordinator, store lead, communications officer, content editors, volunteer coordinator | Bolis, Satvik Store, Content, Communications (two-approver sends), Volunteers |

People only see the areas their role allows; Postgres RLS enforces every row regardless.
A teacher lands on **My classes**; a check-in volunteer lands on their event's scanner.

Platform conventions (tenancy, roles, RPCs, money in cents, design tokens, error rule) are in
[`connect-crm/docs/ARCHITECTURE.md`](../connect-crm/docs/ARCHITECTURE.md). The database schema,
RLS and RPCs live in `connect-crm/supabase/`; this app never changes them.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the values below
pnpm dev                     # http://localhost:3000
```

Sign-in is passwordless: an emailed one-time code (Supabase `signInWithOtp` / `verifyOtp`,
type `email`). Only existing Connect logins can sign in (`shouldCreateUser: false`); access
comes from `app.role_grants`.

If a required variable is missing, every page redirects to `/setup`, which lists what's missing.

### Environment

| Variable | Required | Meaning |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon (public) key. Never the service-role key. |
| `NEXT_PUBLIC_CENTER_SLUG` | no | `app.centers.slug` this console serves (default `jsh`) |

`NEXT_PUBLIC_*` values are inlined at build time — rebuild after changing them.

### Types

`src/lib/database.types.ts` is generated in connect-crm (`supabase/scripts/gen-types.mjs`).
After a migration there, copy the regenerated file here. Do not edit it by hand.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests for the pure rules in `src/lib` (attendance summary, offline scan queue, committee due-date classification, resolution outcome, access mirror, formatting) |

## Layout

```
src/
  proxy.ts                 session refresh + optimistic sign-in redirect (Next 16 "proxy")
  app/
    login/, setup/         one-time-code sign-in; missing-env page
    (console)/             signed-in shell with role-aware navigation
      pathshala/           overview, terms, classes (+ attendance), enrollments, my-classes,
                           signoffs, announcements, committee/{actions,templates,year,concerns,resolutions}
      events/              list, new, [id]?tab=details|checklist|rsvps|volunteers|lunch|report
      bolis/ store/ content/ comms/ volunteers/
    ops/[eventId]/         phone-first volunteer mode: checkin/, kitchen/
    api/people, api/households   RLS-limited search for pickers
  components/              UI kit, ActionForm/ActionButton (error + retry beside the control), pickers
  lib/
    access.ts              mirror of app.has_permission / app.has_scoped_role
    session.ts             per-request viewer, center, grants; load()/rows() helpers
    forms.ts, result.ts    Server Action plumbing: runAction, must, friendlyError
    logic/                 pure, unit-tested rules
tests/                     vitest
```

## Rules worth knowing

- Server Components read; Server Actions write and return `{ ok, error }`. Every action re-checks
  permission (actions are reachable by direct POST); RLS is the final word.
- Errors are always shown in plain English next to the control with **Try again**; technical detail
  goes to the server log.
- Money is integer cents; dates are shown in the center's time zone.
- Bolis take **pledges** (never "bids").
- Sends to all members need two different approvers (DB-enforced; the UI shows "Waiting for a
  second approver").

## Deploy

Every push to `main` builds this app and releases it on the DigitalOcean droplet
(`.github/workflows/deploy.yml`, served on port 8081 until a domain is set). To redeploy
without a code change: Actions › Deploy › Run workflow. Setup, secrets and
troubleshooting: `docs/DEPLOY.md` in connect-crm.
