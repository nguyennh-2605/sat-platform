# Studio Admin design migration

**Status:** Active  
**Started:** 25/08/2026  
**Reference repository:** https://github.com/arhamkhnz/next-shadcn-admin-dashboard  
**Pinned commit:** `64e775837bded678341b09e3ab046d542a1a6a8a`  
**Reference style:** shadcn `radix-nova`, default neutral preset

## Goal

Adopt Studio Admin's visual system and reusable dashboard patterns while keeping SAT Platform's Vite/React Router client, Express/Prisma backend, real data, routes, permissions, and product workflows.

This is a presentation-layer migration, not a Next.js migration.

## Product decisions

- Use the reference's neutral theme during the first migration pass so screens can be reproduced without inventing new design decisions.
- Preserve the SAT Platform name, domain language, roles, data, and functionality.
- Do not copy mock content, demo navigation, fake KPIs, planned features, or Next.js-only behavior.
- Keep Exam Room optimized for Digital SAT readability; it is not required to use the dashboard shell.
- Add an optional SAT Green preset only after the neutral default is consistent across migrated screens.
- Do not provide dashboard image backgrounds or a background picker; use the semantic theme background consistently.
- Pin the reference commit. Upstream changes require an explicit decision and a new migration entry.

## Technical translation

| Studio Admin concept | SAT Platform implementation |
| --- | --- |
| Next.js App Router layout | React Router dashboard shell |
| Server Component page | Normal React page/component |
| `next/link` | `Link` or `NavLink` from `react-router-dom` |
| `next/headers` preferences | Existing client preference/API storage |
| Server actions | Existing Axios + Express endpoints |
| shadcn semantic tokens | Tokens in `client/src/index.css` |
| shadcn UI primitives | Shared components in `client/src/components/ui` |
| Route-local `_components` | Existing owning `pages/` or `features/` directory |

## Reference map

| SAT Platform surface | Primary reference | Secondary reference | Status |
| --- | --- | --- | --- |
| Design tokens and primitives | `src/app/globals.css`, `src/components/ui/` | `components.json` | Foundation complete |
| Dashboard shell | `dashboard/layout.tsx` and dashboard `_components/` | sidebar primitives | Implemented; single global toolbar, visual QA pending |
| Dashboard Home | `dashboard/academy` | `dashboard/default`, `dashboard/productivity` | Implemented; page hierarchy and workspace cards aligned, visual QA pending |
| Authentication | `auth/v2` | `auth/v1` | Implemented; visual QA pending |
| Classroom list/detail | `dashboard/academy` | `dashboard/tasks` | Implemented with unified Activities, course, members, performance, assignments, and no local sticky page header |
| Teacher Test Library / Student Practice Center | `dashboard/infrastructure` | `dashboard/file-manager`, `dashboard/tasks`, `dashboard/default` | Teacher content lifecycle uses My/System sources and Draft/Published/Archived; all test delivery moved to Classroom Activities; Student attempt experience remains separate |
| Create/Edit Test workspace | `dashboard/invoice` | shared `field`, `select`, `tabs`, `card` primitives | Build/Review composition implemented without a stepper; Details and Import share the left card, live preview remains on the right, and Review actions live in the page header |
| Test Bank | `dashboard/file-manager` | `dashboard/tasks` | No standalone route currently; embedded assignment selector aligned |
| Results Analytics | `dashboard/analytics` | `dashboard/default` | Implemented with real attempt data |
| Error Log | `dashboard/tasks` | default data-table patterns | Implemented |
| Vocabulary | `dashboard/tasks` | card/list patterns | Implemented while preserving specialized quiz and flashcard interactions |
| Score Report | `dashboard/analytics` | invoice/print composition | Implemented while preserving score and Math rendering rules |
| Notifications | dashboard header menus | mail list patterns | Implemented for the global menu and classroom post workflow |
| Profile/preferences | `dashboard/profile` | layout controls/theme switcher | Pending |
| Exam Room | SAT product requirements | shared form/content primitives only | Preserve specialized UI |

## Migration phases

### Phase 0 — Safety and instructions

- [x] Checkpoint pre-migration work.
- [x] Create `codex/studio-admin-ui`.
- [x] Add root `AGENTS.md`.
- [x] Pin the reference and define the mapping.
- [x] Update the UI source-of-truth priority.

### Phase 1 — Design-system foundation

- [x] Align neutral semantic tokens, typography, radius, border, and shadow.
- [x] Add or align core shared primitives.
- [x] Keep `AppUI.tsx` as a compatibility facade.
- [x] Add theme infrastructure without requiring a custom SAT preset.
- [x] Validate existing screens still build.

### Phase 2 — Proof of concept

- [x] Migrate dashboard shell.
- [x] Migrate Dashboard Home using real role-aware content.
- [x] Migrate authentication without changing auth behavior.
- [ ] Verify desktop and mobile layouts.

### Phase 3 — Feature migration

- [x] Classroom core surfaces (embedded analytics and vocabulary follow their owning migrations).
- [x] Practice Center and the existing embedded Test Bank selector.
- [x] Separate Teacher Test Library content lifecycle from Classroom test delivery and student attempt state.
- [x] Results Analytics and Score Report.
- [x] Error Log and Vocabulary.
- [x] Shared assignment, test-selection, and announcement overlays.

### Phase 4 — Consolidation

- [ ] Remove obsolete compatibility styles only after all consumers migrate.
- [ ] Add the SAT Green preset if desired.
- [ ] Run a full responsive/accessibility review.
- [ ] Refresh reference screenshots and update this status table.

## Per-screen definition of done

- Uses a named pinned reference and records intentional deviations.
- Keeps existing API calls, permissions, routes, and business behavior.
- Uses shared primitives and semantic tokens; no local duplicate design system.
- Does not show fabricated data while loading or when the API is empty.
- Handles relevant loading, empty, error, disabled, and overflow states.
- Works on mobile and desktop with keyboard-visible focus states.
- Passes targeted lint, `npm run build`, and `git diff --check`.
