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

`eqb-rw-graph-assets-v1.json.gz` contains the 62 College Board Reading and Writing graphs that are inline SVGs in the source Question Bank. The bundle stores lossless 2× PNGs, accessible image descriptions, the corrected visible block layout without duplicated screen-reader-only graph transcripts, and checksums for the legacy and previous repaired blocks plus every image. Bundle SHA-256: `148b75670d742f2be0f579fc7346bdff18951c341071f8aa0b8d5c3bb5a4f2e4`.

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

`eqb-math-graph-assets-v1.json.gz` contains all 272 College Board Math SVG graphs and diagrams used by 250 questions, including graph-based answer choices. It stores lossless 2× PNGs, accessible descriptions, cleaned prompt/choice text, immutable replacement content, and checksums for conflict-safe repair. Bundle SHA-256: `c2fee648d986e1e22222acfce3dbc604070451a89f3982ca21e0d13b95c5755d`.

Build, inspect, and apply it with:

```bash
npm run data:build-question-bank-math-graphs
npm run db:repair-question-bank-math-graphs
npm run db:repair-question-bank-math-graphs -- --apply --require-render
npm run db:audit-question-bank-images -- --require-render
```

The repair uploads PNGs under deterministic SHA-256 storage keys, creates a new immutable question version, and links each asset through `QuestionBankImageUsage`. Existing test snapshots continue to reference their original versions.
