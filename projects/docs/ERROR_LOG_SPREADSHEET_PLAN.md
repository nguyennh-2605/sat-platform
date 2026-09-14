# Error Log spreadsheet implementation

## Accepted scope

Use a viewport-fit working spreadsheet: Category, Source, Correct, Yours, Why I chose wrong, and Why answer is right. System sources open a lazy question modal backed by an immutable question snapshot. Manual entries require a source name, may store an external link, and use a client mutation ID for safe request retries. Keep automatic wrong-answer capture, owner-scoped access, English interface copy, and no SAT countdown.

## Delivery order

1. Preserve legacy whyChosen data by merging escaped plain text into whyWrong; retain the legacy columns. Add the userId/createdAt/id index with an explicit migration.
2. Sanitize semantic reflection HTML on the server and treat empty HTML as empty. `reviewedAt` is always derived from whyWrong and whyRight; clearing either field reopens the row. Ignore deprecated `markReviewed`, `whyChosen`, `takeaway`, and `rootCause` inputs during the rolling-deployment window and return deprecation headers. Preserve those legacy columns for data safety, but exclude them from current responses, behavior, filtering, and search.
3. Add explicit `origin` (`SYSTEM_QUESTION` or `MANUAL`) so behavior does not depend on a nullable relation. Capture immutable question blocks, text, choices, explanation, type, order, section, test title, and subject when automatic rows are created. The lazy owner-scoped question endpoint reads this snapshot first and falls back to the live relation for legacy rows. Backfill snapshots for every still-linked legacy row and retain SYSTEM origin for historical submission rows whose Question relation was already set null.
4. Maintain `searchText` as a normalized plain-text projection of source, category, whyWrong, and whyRight. Default to keyset pagination ordered by `createdAt DESC, id DESC`; limit defaults to 40. Only the first cursor page calculates `total` and `needsReview`. Keep explicit page/pageSize requests compatible with the same stable composite ordering.
5. Add a monotonic row `version`. Update editable data, search projection, derived review state, and version atomically. Clients send `expectedVersion`; stale writes return `409 Conflict` with the current public row. Debounced reflection saves remain serialized per row so two local cell saves cannot race each other.
6. Add `sourceUrl` for manual entries, validate http/https server-side, underline linked names, and open them in a noopener/noreferrer tab. A stable `clientMutationId` is generated once per new-entry dialog; the per-user unique key makes POST retry idempotent.
7. Validate Error Log UUID route parameters before service access. Update/delete/question reads are owner-scoped, and absent or non-owned resources return the same `404`. Attach or validate an `x-request-id` globally and emit structured Error Log failure records with route, status, duration, error name, and Prisma code when available.
8. Use a percentage-width TableVirtuoso on desktop and stacked Virtuoso rows on mobile. Fetch the next cursor automatically, preserve counts from the first page, and show UI only while loading, resolving a conflict, or recovering from an error.
9. Reuse one active ReactQuill editor with a shared toolbar above the table. Preserve drafts above virtual rows, debounce saves for 850ms, flush on blur, and expose Saving/Saved/conflict/Retry states.
10. Verify manual creation and retry idempotency, external navigation, autosave/reload, stale-version conflicts, automatic Reviewed transitions, immutable/legacy modal states, pagination boundaries, search projection, sanitization, UUID validation, owner-scoped 404s, structured errors, desktop fit, and mobile stacking. Run frontend build/targeted lint, server tests, Prisma checks, and diff checks.

## Grid-first performance and interaction iteration

1. Keep react-virtuoso; isolate draft updates instead of replacing virtualization. Drafts live in a keyed registry with per-cell, per-row-dirty, and aggregate-save subscriptions so typing does not update ErrorLog root state.
2. Memoize desktop rows, mobile cards, and sanitized read-only HTML. Deduplicate format state and schedule Quill selection-format reads once per animation frame.
3. Lazy-load Quill and its stylesheet only when the first rich-text cell becomes active. Preserve the hardened-runtime native fallback.
4. Replace separate filter, formatting, and count strips with one sticky shadcn DataToolbar. Add status chips backed by owner-scoped facets, a shared searchable Combobox for exact categories, and a compact accessible status icon column.
5. Keep reflection cells compact and read-only until selected. Mount one expanded editor outside the virtual rows: an anchored non-modal Popover on desktop and a bottom Sheet on mobile, so editing long notes never changes row height.
6. Support Enter/F2, formatting shortcuts, link shortcut, Tab/Shift+Tab cell movement, Escape, and save-and-exit through one capture dispatcher that ignores IME composition and prevents duplicate Quill handling. Edit links inline in the shared toolbar so selection and focus remain stable.
7. Switch between table and stacked cards from the actual DataSurface width, including laptop layouts with the navigation sidebar open, so the workspace never requires horizontal scrolling.
8. Show reflection previews at their natural height up to 320px on desktop and 288px on mobile. Detect real overflow before showing Show more/less, preserve expansion in a keyed registry across virtual-row unmounts, freeze the active preview while typing, and reuse sanitized output through a bounded cache.

## Compatibility and rollout

- Run `prisma migrate deploy` before deploying the new client/server. Migrations `20260910110000_error_log_spreadsheet`, `20260911090000_add_error_log_source_url`, `20260912090000_error_log_integrity_and_search`, and `20260912100000_backfill_error_log_question_snapshots` have been applied to the local sat_db.
- Deploy the database migrations before the new server. The integrity migration adds origin, snapshot, search projection, versioning, idempotency, and composite indexes; the follow-up migration backfills question snapshots and recovers SYSTEM origin where historical submission evidence survives.
- PUT remains temporarily accepted as a deprecated compatibility alias and returns deprecation headers; new callers use PATCH. Explicit offset pagination remains available for existing callers.
- Legacy `whyChosen`, `takeaway`, and `rootCause` columns remain in the schema to avoid destructive data loss. They are temporarily accepted and ignored for cached-client compatibility, emit deprecation headers, and are not returned, filtered, or searched.
- No new editor/virtualization dependency. `sanitize-html` is the server-side security dependency.
- Desktop columns fit the available width; mobile rows stack without horizontal scrolling. Only the active rich-text cell mounts Quill; persisted cells use RichTextContent.
- An edited row stays visible until the list is refreshed or filters change, allowing the student to finish editing even when its review status changes.

## Verification evidence

- Server suite covers semantic HTML sanitization, empty HTML, external URL validation, ownership, derived completion, legacy-input compatibility, optimistic conflicts, idempotent manual creation, snapshot fallback, UUID validation, stable pagination, and duplicate protection.
- Browser QA covers manual source name/link creation, external tab navigation, shared Bold formatting, inline save, automatic Reviewed without root cause, and full linked-question modal rendering.
- Local 10k-row fixture: initial batch 40; scrolling reached 120 loaded while the accessibility tree contained roughly 6–10 data rows. No editors were mounted in read mode. All 10,001 temporary QA entries were removed afterward.
- This is a functional virtualization check, not an FPS benchmark across devices.
