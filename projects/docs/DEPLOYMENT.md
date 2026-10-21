# SAT Platform deployment runbook

This runbook assumes the repository CI workflow is green before a deployment. Production credentials belong in the hosting providers, never in GitHub source files or local `.env` files committed to Git.

## Runtime contract

- Node.js: `24.x`, matching `.nvmrc` and both package manifests.
- Frontend root: `client`; install `npm ci`; build `npm run build`; publish `dist`.
- Backend root: `server`; install `npm ci`; start `npm start`.
- Database schema changes: run `npm run db:migrate:deploy` as the backend pre-deploy command.
- Render without a separate pre-deploy phase: use `npm run start:render` as the Start Command. It applies migrations before starting the API.
- Liveness probe: `GET /health` checks only the Node process.
- Readiness probe: `GET /ready` checks PostgreSQL and returns `503` without leaking the database error when unavailable.

## Production services

Keep each service isolated:

1. Vercel hosts the Vite client.
2. Render hosts the Express API and runs the storage cleanup Cron Job described in `STORAGE_OPERATIONS.md`.
3. Managed PostgreSQL stores application data and must have automated backups enabled.
4. A private R2/S3-compatible bucket stores managed files with production-only credentials.
5. Separate Sentry projects receive client and server errors.

Do not enable provider auto-deploy until the GitHub CI workflow has passed on the deployment branch. Deploy production only from `main`.

## Backend environment

Set every value from `server/.env.example`. Production additionally requires:

- `NODE_ENV=production`
- `DATABASE_URL` for the production database
- exact HTTPS origins in `CORS_ORIGINS`
- a unique, high-entropy `JWT_SECRET`
- production Google, Gemini, and object-storage credentials
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`, and the deployed commit in `SENTRY_RELEASE`
- `LOG_LEVEL=info`

Keep `SENTRY_TRACES_SAMPLE_RATE=0` for the first pilot. Increase it deliberately after checking event volume and privacy.

## Frontend environment

Set the values documented in `client/.env.example`. `VITE_API_URL` must be the public HTTPS API origin. Add the deployed frontend origin to Google OAuth and to backend `CORS_ORIGINS`.

All `VITE_*` values are public browser configuration. Never put a private API secret in a `VITE_*` variable.

## Deployment sequence

1. Confirm the branch CI run is green.
2. Confirm a recent database backup exists.
3. Run `npm run db:migrate:deploy` in the backend pre-deploy phase.
4. Deploy the backend and wait for `/ready` to return `200`.
5. Deploy the frontend.
6. Verify sign-in, one authorized API read, and one role-restricted route.
7. Run the dedicated production smoke account through `npm run test:deploy` from `server/`.
8. Check Sentry and structured logs using the deployment commit and request IDs.

The deploy smoke variables are documented in `server/scripts/deploy-smoke-test.js`. Use only a dedicated test student and disposable test assignment. Do not paste its token into an issue or workflow log.

## Switching databases and preparing the Question Bank

Changing `DATABASE_URL` does not transfer records. Prisma migrations create the schema, but do not restore users, classes, attempts, or Question Bank content. To preserve an existing installation, restore its database backup into the replacement database and verify that the API points to it. Keep the corresponding object-storage bucket and credentials available for restored file metadata.

Do not put `db:publish-question-bank` or `db:audit-question-bank-images` in the API Start Command. The publisher only updates existing records. The image audit intentionally fails when the bundled 3,767 questions or repaired graphs are absent, which prevents `npm start` from running in a chained command on a fresh database.

Render configuration (service root: `server`):

- Build Command: `npm ci` (the existing postinstall generates Prisma Client).
- Start Command: `npm run start:render`.
- Alternatively, use `npm run db:migrate:deploy` as Pre-Deploy Command and `npm start` as Start Command.
- Health Check Path: `/ready`.

For an intentionally fresh database:

1. Deploy the API with the Start Command above so Google sign-in can create the owner's account.
2. Sign in with the platform owner's real Google account and promote that account using the production CLI procedure in `GOOGLE_AUTH_SETUP.md`. The importer requires an existing Admin; it does not create one or grant roles automatically.
3. Confirm the Render service's `DATABASE_URL` and production object-storage settings point to the intended environment.
4. In Render Shell, from `server`, run:

   ```bash
   npm run db:prepare:question-bank
   ```

This explicit maintenance command imports the checked-in dataset, repairs Reading and Writing graphs, repairs Math graphs, publishes System questions, and audits the result, stopping at the first failure. It requires Render and a non-loopback database for writes. Matching imports and graph repairs can be rerun without duplicating questions or versions; conflicting content still fails for inspection. Publishing retains the existing publisher's behavior of publishing all System items, so run this command only when that is intended.

Confirm the final audit reports `questionCount: 3767`, zero pending/conflicting graphs, and no failures. If the command fails because storage is unavailable or content conflicts, resolve the reported cause and rerun it. The API can remain available for account setup while the Question Bank is being prepared. This command only loads the bundled Question Bank; it does not recover other data from the old database.

## Rollback

- Frontend: promote the previous known-good Vercel deployment.
- Backend: redeploy the previous known-good Render revision.
- Database: prefer a forward fix. Schema migrations must remain backward compatible across the previous and current application revisions.
- Never run an automatic destructive schema rollback against production.

## Backup and restore verification

Enable the managed PostgreSQL backup or point-in-time recovery feature before inviting real users. Record retention and recovery-point guarantees in the provider dashboard.

At least monthly, restore the newest backup into a separate database whose name visibly includes `restore_test`. Never overwrite production for a drill.

Example for a provider that supports standard PostgreSQL tools:

```text
pg_dump --format=custom --no-owner --no-acl DATABASE_URL > sat-platform.dump
pg_restore --clean --if-exists --no-owner --no-acl --dbname RESTORE_TEST_DATABASE_URL sat-platform.dump
```

After restore:

1. Point a temporary backend instance at the restored database.
2. Confirm `/ready` returns `200`.
3. Check representative users, classes, submissions, scores, reviews, and file metadata.
4. Run a read-only smoke pass.
5. Record the backup timestamp, restore duration, result, and operator.
6. Delete the temporary restored database after the verification record is complete.

## Required manual configuration

Google-only authentication and admin-approved teacher access are documented in [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md). Frontend and backend Google Client IDs must match; apply the teacher-access migration before deploying this auth revision.

Repository files cannot create provider projects, domains, OAuth callbacks, production databases, backup policies, alert recipients, or secrets. Track those manual items with the release checklist in this document and verify them after every provider change.

## Known dependency advisory

The client currently retains `react-quill-new@3.8.3`, whose `quill@2.0.3` dependency produces two low-severity `npm audit` findings. The proposed forced audit fix downgrades the editor wrapper and may introduce an editing regression, so it is not applied automatically. Dependabot should track an upstream compatible fix; validate rich-text editing before accepting any editor dependency change. The server currently has no known `npm audit` findings.
