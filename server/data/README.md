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
