# Managed file storage operations

SAT Platform stores assignment files in a private S3-compatible bucket. The API stores object keys in PostgreSQL and issues short-lived presigned URLs; credentials and signed URLs must never be logged or sent to the client except for the requested operation.

## Environment isolation

Use separate buckets and credentials for development and production. Scope each R2 token to one bucket with Object Read & Write permission.

Development API:

```env
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
OBJECT_STORAGE_PROVIDER=R2
OBJECT_STORAGE_BUCKET=sonder-sat-dev
```

Production API:

```env
NODE_ENV=production
CORS_ORIGINS=https://sonder-sat.vercel.app
OBJECT_STORAGE_PROVIDER=R2
OBJECT_STORAGE_BUCKET=sonder-sat-prod
```

`CORS_ORIGINS` is a comma-separated list of exact browser origins without paths or trailing slashes. Production startup fails when it is missing. The non-production fallback contains localhost only.

R2 bucket CORS is separate from Express API CORS. Configure the bucket to permit the frontend origins and `GET`, `PUT`, and `HEAD` with the `Content-Type` request header.

## Production cleanup on Render

Create a Render Cron Job using the same repository and production environment variables as the API service.

```text
Name: SAT Platform storage cleanup
Root directory: server
Command: npm run storage:cleanup
Schedule: once per day
```

The Cron Job requires production `DATABASE_URL` and every `OBJECT_STORAGE_*` variable. It does not need frontend variables. Use the production bucket token, never the development token.

Cleanup processes at most 200 candidates per run using five concurrent workers. The bounded worker pool avoids both slow sequential R2 round trips and an unbounded burst against R2 or PostgreSQL:

- `PENDING_UPLOAD` older than 24 hours;
- unattached `READY` assets older than 24 hours;
- all `PENDING_DELETE` assets.

For every candidate it deletes the object first and then its database record. Failed deletions remain `PENDING_DELETE` for the next run. Structured logs report `started`, `candidates`, `processed`, `failed`, and `durationMs` without object keys or credentials.

If daily volume can exceed 200 stale assets, increase the schedule frequency rather than increasing the batch without measuring job duration.

## Development lifecycle

The development bucket may use an R2 lifecycle rule that deletes objects after 30 days because development data is disposable. Do not apply a blanket expiration rule to the production bucket; production retention is controlled by application state and cleanup.

## Real storage smoke test

Run only against a development or dedicated CI bucket unless production verification is intentional:

```powershell
$env:STORAGE_SMOKE_ENABLED='true'
npm run storage:smoke
Remove-Item Env:STORAGE_SMOKE_ENABLED
```

Linux/Render shell:

```bash
STORAGE_SMOKE_ENABLED=true npm run storage:smoke
```

The smoke test writes a small text object, verifies metadata, downloads and compares its bytes, and deletes it in `finally`. It never writes to the application database and never prints a presigned URL or object key. The command refuses to run without the explicit opt-in flag.

## Operational response

- Presign failures: confirm endpoint, bucket, token scope, and credentials.
- Metadata verification failures: confirm Object Read permission and outbound network access.
- Cleanup delete failures: inspect the safe error code in the structured log; the asset remains queued for retry.
- Browser upload failures: verify both the exact R2 bucket CORS origin and the API `CORS_ORIGINS` value.
