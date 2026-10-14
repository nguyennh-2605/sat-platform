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
| Dashboard shell | `dashboard/layout.tsx` and dashboard `_components/` | sidebar primitives | Implemented; single global toolbar plus a server-backed, cross-tab Student Focus Clock; visual QA pending |
| Dashboard Home | `dashboard/default`, `dashboard/crm`, `dashboard/finance`, `dashboard/analytics` | `dashboard/academy`, `dashboard/productivity` | Role-dispatched; Admin uses real KPI/chart/attention/snapshot data plus a Studio-style AuditEvent Recent Activity table; Student retains Productivity's 9/3 task-and-calendar layout with the original summary and practice cards; an Open planner link in the Tasks card opens the dedicated Student Study planner for Day/Week/Month calendars, planned days, task editing and dragging/Undo; Teacher uses an Academy-style action-first overview with class scope, deadline attention, compact schedule, 30-day class pulse, independently loaded learning insights, and evidence-based check-ins; visual QA pending |
| Student Study Planner | robskinney FullCalendar (user-selected presentation); `dashboard/calendar` shared anatomy | FullCalendar TimeGrid and DayGrid | Centered toolbar and viewport-centered event modal; Day/Week time grids and Month calendar; explicitly learner-planned events only, with no automatic deadline events. Overview Tasks uses neutral rows with a circular quick-completion checkbox before the title and time aligned right, while sharing completion, details/edit modal and mutations, without drag handles or source badges. Selectable persisted colors, neutral title/time contrast, stronger hour dividers, rectangular events, initial-letter capitalization and full-box completion strikes; no Unscheduled tray or timezone footer. Shared primitives, learner-owned time/color fields and unchanged source deadlines. See `STUDENT_STUDY_PLANNER.md`. |
| Authentication | `auth/v2` | `auth/v1` | Google-only sign-in and account creation; favicon-aligned Sonder Cat, light/dark welcome gradient, responsive neutral auth card, inline recovery/error states. New users are students. Settings accepts teacher requests; an Admin-only Teacher access screen reviews requests with audited atomic approvals. Existing teacher roles are retained. See `GOOGLE_AUTH_SETUP.md`. |
| Public landing | `auth/v2` neutral brand/content hierarchy and shared radix-nova primitives | `dashboard/productivity` spacing and content density | Redesigned October 2026 with favicon-aligned v2 Sonder Cat, a product screenshot hero, four feature sections with real desktop/mobile and light/dark captures, learning loop, classroom overview, FAQ, and existing auth/dashboard CTAs. One-time scroll reveals support keyboard focus, reduced motion, and observer fallback. Intentional marketing deviations: larger responsive hero typography and section spacing; no fabricated metrics or inactive Roadmap promotion. Authentication remains unchanged. Capture provenance: `LANDING_SCREENSHOTS.md`. |
| Classroom list/detail | `dashboard/academy` | `dashboard/tasks` | Student empty-state/toolbar Join a class accepts the teacher's existing class code in a viewport-centered shared dialog and opens Lessons after enrollment; Teacher/Admin retains Create class. Implemented with a teacher-first Lessons landing, announcements, Assignment/Test Activities, a dedicated class Performance workspace, evidence-backed targeted follow-ups with baseline/outcome verification, members, and no local sticky page header. Assignment Detail uses a role-aware shared shell, sticky Student work rail, and Teacher Student Work master-detail review queue with optional points/feedback |
| Classroom Lessons curriculum | `dashboard/infrastructure` and shared radix-nova primitives | Circle/Teachable curriculum hierarchy | Implemented as a role-aware Week → Session outline plus a single-view Lesson Workspace. Teachers compose persisted `Before class`, `During class`, and `After class` stages for notes, private files, embedded video, assignments, and existing tests; attendance with optional per-student notes lives in the responsive right rail; students receive ordered content, resume, and required-block completion |
| Admin Test Management / Teacher Test Library / Student Practice Center | `dashboard/tasks`, `dashboard/infrastructure` | `dashboard/file-manager`, `dashboard/default` | Admin uses platform-owned System Library and read-only Teacher Tests; Teacher Test Library manages content lifecycle only; Classroom Activities/Lessons own test delivery; Student attempt experience remains separate |
| Create/Edit Test workspace | `dashboard/invoice` | shared `field`, `select`, `tabs`, `card` primitives | Build/Review composition implemented without a stepper; Details and Import share the left card, live preview remains on the right, and Review actions live in the page header |
| Test Bank | `dashboard/file-manager` | `dashboard/tasks` | No standalone route currently; embedded assignment selector aligned |
| Question Bank | `dashboard/tasks`, `dashboard/file-manager` | shared DataSurface/Table and content-dialog | Implemented as role-scoped Admin System and Teacher Personal/System libraries; the Create/Edit Test workspace can copy selected immutable bank versions into test snapshots |
| Learning Roadmap | `dashboard/academy`, `dashboard/tasks` | shared Card, Progress, Modal, and content-dialog patterns | Admin milestone builder remains available; the unfinished Student route, navigation, and practice endpoints are temporarily disabled |
| Results Analytics | `dashboard/analytics` | `dashboard/default` | Student diagnostic workspace implemented as one scrollable page with URL-backed range/subject filters, sticky anchor navigation, rule-based Focus Areas, cross-subject snapshot, independently loaded Study Consistency from completed Focus Clock sessions, real attempt accuracy trend, expandable SAT skill hierarchy, Error Log review links, QuestionTiming pacing coverage, and paginated completed Attempts. Study time remains explicitly opt-in tracked focus time rather than inferred wall-clock activity |
| Error Log | `dashboard/tasks` | working spreadsheet; shared DataSurface/Table and non-modal Dialog | Container-responsive grid/cards virtualized against one page scroll container with static filters/column headers; square-cornered out-of-row reflection workspace with local formatting/save controls and optional side-by-side snapshot question context (stacked on mobile), full-cell selection borders, coordinated Quill-native shortcuts, inline link editing, review chips/facets, searchable category filter, keyed drafts, serialized optimistic autosave/conflict recovery, automatic cursor loading, and idempotent external manual sources |
| Vocabulary | `dashboard/tasks` | Quizlet/Knowt set-first workflow, rich-list patterns | Redesigned October 2026 around a full-width, API-backed daily FSRS practice card, followed by searchable Personal/Library/Assigned collections. Collection details and the word rich list share one surface, with four desktop columns, labelled mobile rows and clear row dividers. The collection search and creation controls share a row, and the selected collection has a stronger neutral outline. Daily quiz/recall sessions are resumable, show next-review feedback and support mobile/keyboard/error recovery. Manual collection study, teacher assignments, range/mastery setup, persisted Shuffle and editing remain available. Dictionary save copies no original sentence or source passage. See VOCABULARY_FSRS.md |
| Score Report | `dashboard/analytics` | invoice/print composition | Implemented while preserving score and Math rendering rules |
| Notifications | dashboard header menus | mail list patterns | Implemented for the global menu and classroom post workflow |
| Profile/preferences | `dashboard/profile` | layout controls/theme switcher | Implemented with display-name editing, role-aware Student study preferences, account context, and light/dark/system appearance controls; visual QA pending |
| Exam Room | SAT product requirements | shared form/content primitives only | Preserve specialized UI; English dictionary selection popover in RW Practice, shared with Score Report and Error Log question review, independent of highlight mode and backed by persistent shared cache |

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
- [x] Pre-attempt setup for System tests with per-attempt Practice/Exam mode and timing presets.
- [x] Separate Teacher Test Library content lifecycle from Classroom test delivery and student attempt state.
- [x] Add dedicated Admin Test Management with System Library, read-only Teacher Tests, and Copy to System Library.
- [x] Results Analytics and Score Report.
- [x] Error Log and Vocabulary.
- [x] Shared assignment, test-selection, and announcement overlays.
- [x] Add Question Bank selection to test authoring and the Admin Roadmap builder.
- [ ] Resume the Student Roadmap route and milestone practice flow after the screen is completed.

### Phase 4 — Consolidation

- [ ] Remove obsolete compatibility styles only after all consumers migrate.
- [ ] Add the SAT Green preset if desired.
- [ ] Run a full responsive/accessibility review.
- [ ] Refresh reference screenshots and update this status table.

## Per-screen definition of done

All popup dialogs center on the full viewport, including the sidebar, as requested by the user. Both shared Modal popup presentations portal into document.body without sidebar offsets. The modeless Error Log reflection workspace and inline content panels retain their workspace placement.

- Uses a named pinned reference and records intentional deviations.
- Keeps existing API calls, permissions, routes, and business behavior.
- Uses shared primitives and semantic tokens; no local duplicate design system.
- Does not show fabricated data while loading or when the API is empty.
- Handles relevant loading, empty, error, disabled, and overflow states.
- Works on mobile and desktop with keyboard-visible focus states.
- Passes targeted lint, `npm run build`, and `git diff --check`.
