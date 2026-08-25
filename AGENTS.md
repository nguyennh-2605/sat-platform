# SAT Platform agent instructions

## Read first

Before changing code, read the documents relevant to the task:

- `projects/docs/ARCHITECTURE.md` for system boundaries, request flow, routes, and data ownership.
- `UI_GUIDELINES.md` for every frontend or visual change.
- `projects/docs/DESIGN_MIGRATION.md` while the Studio Admin migration is in progress.
- `CODING_CONVENTIONS.md` for backend, database, API, security, and naming conventions.

## Architecture boundaries

- Keep the existing client-server architecture: React 19 + TypeScript + Vite + React Router in `client/`, and Express + Prisma in `server/`.
- Do not migrate the application to Next.js. The Studio Admin repository is a visual and component reference, not the target runtime architecture.
- Keep existing routes, API contracts, authorization rules, and business logic unless the user explicitly requests a behavior change.
- Use real API data. Do not copy demo data, fake KPIs, fake users, or placeholder business features from a reference screen.
- Do not copy Next.js Server Components, server actions, `next/headers`, cookies APIs, or App Router conventions into the Vite client.

## Studio Admin design direction

- Visual reference: `https://github.com/arhamkhnz/next-shadcn-admin-dashboard` pinned to commit `64e775837bded678341b09e3ab046d542a1a6a8a`.
- A local read-only clone may exist at `tmp/next-shadcn-admin-dashboard/` and must not be committed.
- Follow the reference's default neutral `radix-nova` direction for layout, density, typography, component anatomy, responsive behavior, and interaction states.
- Preserve SAT Platform branding and domain content. Add a custom SAT color preset only after the neutral migration is consistent.
- Prefer the closest non-legacy reference screen listed in `projects/docs/DESIGN_MIGRATION.md`.

## Frontend rules

- Use semantic tokens from `client/src/index.css` and shared primitives from `client/src/components/ui`.
- Extend a shared primitive before creating a feature-local Button, Card, Input, Select, Modal, Tabs, Table, Badge, Toast, Skeleton, or EmptyState pattern.
- Keep `AppUI.tsx` as a compatibility facade during migration. Do not force unrelated screens to migrate in the same change.
- Keep page components focused on composition; place complex screen-specific sections in the owning page or feature directory.
- Every changed screen must handle relevant loading, empty, error, disabled, overflow, mobile, keyboard, and focus states.
- Exam Room content and Math/LaTeX rules in `UI_GUIDELINES.md` are product constraints and override dashboard reference styling.
- User-facing interface copy is English.

## Change discipline

- Keep changes scoped. Do not refactor unrelated code or reorganize directories without an explicit request.
- Preserve user changes already present in the worktree.
- Add dependencies only when they are necessary for the shared design-system foundation.
- When copying a substantial portion of the MIT-licensed reference, retain the required license notice.

## Validation

- Frontend changes: run `npm run build` and targeted lint from `client/`.
- Backend behavior changes: run `npm test` from `server/`.
- Database changes: update `server/prisma/schema.prisma` first and include an explicit migration.
- Before handoff, run `git diff --check` and report any validation that was not run or did not pass.
