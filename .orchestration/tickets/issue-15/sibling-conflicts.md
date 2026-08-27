# Sibling-PR conflict check

## Overlapping PRs

| PR | Title | Author | Overlapping paths |
|---|---|---|---|
| #24 | [MVP] Design PostgreSQL schema (issue #3) | CarlosCunha99 | `.env.example`, `README.md`, `package.json`, `package-lock.json` |
| #23 | [MVP] Surface total likes and downloads (issue #11) | CarlosCunha99 | `.env.example`, `README.md`, `package.json`, `package-lock.json` |
| #22 | [MVP] Build teacher profile pages (issue #8) | CarlosCunha99 | `README.md` |

## Conflict summary

- **`.env.example`**: PR #24 adds DB connection vars; PR #23 adds resource vars; our PR adds Stripe vars. All are additive to different sections — likely non-conflicting textual merge.
- **`README.md`**: All PRs add different sections. Textual merge conflicts possible but resolvable.
- **`package.json`**: PR #24 adds Prisma/DB deps; PR #23 adds other deps; our PR adds `stripe`. Additive; merge conflicts probable in the `dependencies` block but resolvable.
- **`package-lock.json`**: Will conflict and require re-running `npm install` after merge.

## Recommendation

`flag-in-pr-body` — conflicts are additive-only (no logic changes to shared files). Standard merge conflict resolution on `.env.example`, `README.md`, `package.json` will be required when branches land. The Prisma schema PR (#24) is the most important sibling to coordinate with since our in-memory subscriptions implementation is designed to be replaced by Postgres in issue #3.

## Notes

- Our billing implementation depends on issue #3 (DB schema) for production storage.
- Our entitlement helper (`isUserPremium`) is designed to be consumed by issue #11's download endpoint.
- No overlapping source files outside the above docs/config files.
