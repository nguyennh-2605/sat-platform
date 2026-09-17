# SAT Platform deployment runbook

This runbook assumes the repository CI workflow is green before a deployment. Production credentials belong in the hosting providers, never in GitHub source files or local `.env` files committed to Git.

## Runtime contract

- Node.js: `24.x`, matching `.nvmrc` and both package manifests.
- Frontend root: `client`; install `npm ci`; build `npm run build`; publish `dist`.
- Backend root: `server`; install `npm ci`; start `npm start`.
- Database schema changes: run `npm run db:migrate:deploy` as the backend pre-deploy command.
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

Repository files cannot create provider projects, domains, OAuth callbacks, production databases, backup policies, alert recipients, or secrets. Track those manual items with the release checklist in this document and verify them after every provider change.

## Known dependency advisory

The client currently retains `react-quill-new@3.8.3`, whose `quill@2.0.3` dependency produces two low-severity `npm audit` findings. The proposed forced audit fix downgrades the editor wrapper and may introduce an editing regression, so it is not applied automatically. Dependabot should track an upstream compatible fix; validate rich-text editing before accepting any editor dependency change. The server currently has no known `npm audit` findings.
