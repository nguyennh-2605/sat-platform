# Error Log spreadsheet implementation

## Accepted scope

Use a viewport-fit working spreadsheet: Category, Source, Correct, Yours, Why I chose wrong, and Why answer is right. System sources open a lazy question modal. Manual entries require a source name and may store an external link. Keep automatic wrong-answer capture, ownership rules, English interface copy, and no SAT countdown.

## Delivery order

1. Preserve legacy whyChosen data by merging escaped plain text into whyWrong; retain the legacy column. Add the userId/createdAt/id index with an explicit migration.
2. Sanitize semantic reflection HTML on the server; treat empty HTML as empty. A review requires whyWrong and whyRight. Root cause and next step remain legacy database fields but are absent from the new workflow.
3. Default to keyset pagination ordered by createdAt DESC, id DESC; limit defaults to 40. Keep explicit page/pageSize requests compatible. List responses exclude question content; add an owner-scoped question endpoint.
4. Use a percentage-width TableVirtuoso on desktop and stacked Virtuoso rows on mobile. Keep server-side search, status, and exact-category filters. Fetch the next cursor automatically and show UI only while loading or recovering from an error.
5. Reuse one active ReactQuill editor with a shared toolbar above the table. Preserve drafts above virtual rows, debounce saves for 850ms, flush on blur, serialize saves per entry, and expose errors/retry.
6. Add sourceUrl for manual entries, validate http/https server-side, underline linked names, and open them in a noopener/noreferrer tab. System questionId sources open the lazy content modal.
7. Verify manual creation, external navigation, autosave/reload, formatting, automatic Reviewed transitions, modal states, pagination boundaries, sanitization, permissions, desktop fit, and mobile stacking. Run frontend build/targeted lint, server tests, Prisma checks, and diff checks.

## Compatibility and rollout

- Run `prisma migrate deploy` before deploying the new client/server. Migrations `20260910110000_error_log_spreadsheet` and `20260911090000_add_error_log_source_url` have been applied to the local sat_db.
- PUT remains supported alongside PATCH. Explicit offset pagination remains available for existing callers.
- No new editor/virtualization dependency. `sanitize-html` is the server-side security dependency.
- Desktop columns fit the available width; mobile rows stack without horizontal scrolling. Only the active rich-text cell mounts Quill; persisted cells use RichTextContent.
- An edited row stays visible until the list is refreshed or filters change, allowing the student to finish editing even when its review status changes.

## Verification evidence

- Server suite covers semantic HTML sanitization, empty HTML, external URL validation, ownership, completion transitions, duplicate protection, and cursor traversal through 1k/5k/10k tied-timestamp rows.
- Browser QA covers manual source name/link creation, external tab navigation, shared Bold formatting, inline save, automatic Reviewed without root cause, and full linked-question modal rendering.
- Local 10k-row fixture: initial batch 40; scrolling reached 120 loaded while the accessibility tree contained roughly 6–10 data rows. No editors were mounted in read mode. All 10,001 temporary QA entries were removed afterward.
- This is a functional virtualization check, not an FPS benchmark across devices.
