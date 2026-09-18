## Summary

Describe the user-facing or operational outcome of this change.

## Validation

- [ ] Client unit tests pass (`npm test` in `client/`)
- [ ] Client lint passes (`npm run lint` in `client/`)
- [ ] Client production build passes (`npm run build` in `client/`)
- [ ] Browser smoke tests pass (`npm run test:e2e` in `client/`)
- [ ] Full-stack golden paths pass when this change affects a critical journey (`npm run test:e2e:full` in `client/`)
- [ ] Server tests pass (`npm test` in `server/`)
- [ ] Significant business logic has a server/unit test in this PR
- [ ] A new important user journey has at least one Playwright happy path
- [ ] A serious bug fix includes a regression test
- [ ] Database migrations are backward compatible, or this change has no migration
- [ ] No secret, token, production data, or local `.env` file is included

## Deployment notes

List environment-variable, migration, smoke-test, or rollback considerations. Write `None` when there are none.
