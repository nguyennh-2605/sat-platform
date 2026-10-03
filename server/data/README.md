# Production question bank dataset

`eqb-question-bank-v1.json.gz` contains the normalized Sonder SAT question-bank payload used for the production import.

- Schema version: `1`
- Questions: `3,767`
- Reading and Writing: `1,845`
- Math: `1,922`
- SHA-256: `11cbffba8cbb7ea0d4be3ea43ce72b027e6aa8c07a5a695819f0c92cd8ed5dc9`

Run a validation-only check from `server/`:

```bash
npm run db:import:question-bank
```

Applying the dataset requires the explicit `--apply` flag and a non-loopback `DATABASE_URL`. The importer validates the complete payload before opening a transaction, serializes concurrent imports with a PostgreSQL advisory lock, verifies deterministic existing records, and checks the final item/version counts before commit. Any error rolls back the entire import.

Imported questions use `SYSTEM` scope and start in `DRAFT` status so an administrator can review them before publishing.

## Reading and Writing graph repair

`eqb-rw-graph-assets-v1.json.gz` contains the 62 College Board Reading and Writing graphs that are inline SVGs in the source Question Bank. The bundle stores lossless 2× PNGs, accessible descriptions, the corrected block layout, and checksums for the legacy blocks and every image. Bundle SHA-256: `f5f50b593006bc5cc648ce62dd3b0ec18508508c2bcd4fe654c46742266ba5f7`.

Build the bundle from a local `sat-eqb-downloader` JSONL export:

```bash
npm run data:build-question-bank-rw-graphs
```

Inspect a configured database without changing it:

```bash
npm run db:repair-question-bank-rw-graphs
```

Apply the idempotent repair on Render:

```bash
npm run db:repair-question-bank-rw-graphs -- --apply --require-render
```

The repair uploads PNGs under deterministic SHA-256 storage keys, creates a new immutable question version, and links each asset through `QuestionBankImageUsage`. Existing test snapshots continue to reference their original versions.
