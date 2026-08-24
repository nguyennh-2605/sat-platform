# Admin account management

Admin accounts are managed only through the server CLI. The public registration API cannot create an `ADMIN`, and there is no HTTP endpoint for privilege elevation.

## Local development

Run commands from `server/`. The CLI reads `server/.env` and verifies that `DATABASE_URL` points to localhost.

Create a password-based local Admin:

```powershell
npm run admin:create -- --environment local --email admin.local@example.test --name "Local Admin"
```

The password is requested in a hidden terminal prompt. It must be at least 14 characters and no more than 72 UTF-8 bytes. Never pass a password as a command-line flag.

Rotate the local password:

```powershell
npm run admin:rotate-password -- --environment local --email admin.local@example.test
```

Promote an existing local Student or Teacher:

```powershell
npm run admin:promote -- --environment local --email existing@example.test
```

## Production deployment

1. Create a dedicated Google account for administration and enable Google MFA.
2. Deploy the latest migrations, or run `npm run db:migrate:deploy` from the provider shell.
3. Sign in to the deployed app once with that Google account. It will initially be a Student and its verified Google subject will be stored.
4. Open the hosting provider's backend shell, where `DATABASE_URL` points to production.
5. Run:

```bash
npm run admin:promote -- --environment production --email admin@your-domain.com --confirm-production
```

6. Type `PRODUCTION` when prompted, then sign in again.

Production promotion only accepts an account verified through Google sign-in, with a stored Google subject and without an application password. Password-based Admin creation and password rotation are disabled against a remote production database.

## Emergency commands

Revoke all refresh sessions for an Admin:

```powershell
npm run admin:revoke-sessions -- --environment local --email admin.local@example.test
```

For production, add `--confirm-production` and type `PRODUCTION` when prompted.

Demote an Admin:

```powershell
npm run admin:demote -- --environment local --email admin.local@example.test --role TEACHER
```

The CLI refuses to demote the final Admin. Supported target roles are `STUDENT` and `TEACHER`.

## Security behavior

- Every create, promote, password rotation, session revocation, and demotion is written to `AdminAuditLog`.
- Role and password changes revoke existing refresh sessions.
- Production operations require both `--confirm-production` and an exact interactive confirmation.
- Passwords are never stored in source code, command history, CLI logs, or audit metadata.
- Public registration remains limited to Student and Teacher roles.
- Google accounts are identified by Google's stable `sub` claim. An existing password account is never linked automatically by matching email alone.
