# Implementation context (shared A/B brief)

> This brief is for both the **coder** and the **tester**. Read it before touching any
> file. It captures codebase conventions, utilities to reuse, and commands that are
> verified to work.

---

## Files this touches

- `prisma/schema.prisma` — (new) Prisma datasource, generator, all 10 MVP models, enums, indexes, cascade/restrict rules
- `prisma/migrations/<timestamp>_init/migration.sql` — (new, auto-generated) initial DDL for all 10 tables
- `prisma/migrations/migration_lock.toml` — (new, auto-generated) provider lock file
- `prisma/seed.ts` — (new) deterministic, idempotent fixture seeder
- `prisma/__tests__/schema.unit.test.ts` — (new) static DMMF assertions; no live DB
- `prisma/__tests__/migrations.integration.test.ts` — (new) migration apply/reset tests; requires `DATABASE_URL`
- `prisma/__tests__/integrity.integration.test.ts` — (new) FK + unique constraint enforcement tests
- `prisma/__tests__/seed.integration.test.ts` — (new) seed row-count and idempotency tests
- `prisma/__tests__/query-performance.integration.test.ts` — (new) EXPLAIN-based index usage tests
- `prisma/__tests__/helpers/testDb.ts` — (new) shared test client and truncate/reset helpers
- `src/lib/db.ts` — (new) Prisma client singleton; exported named export `prisma`
- `docs/DATABASE.md` — (new) DAL guide: entity overview, query patterns, soft-delete, cascade, taxonomy notes
- `package.json` — (modified) add `@prisma/client` dep, `prisma`+`tsx` devDeps, 6 new scripts, `postinstall`, `prisma.seed` config block
- `.env.example` — (modified) uncomment and document `DATABASE_URL` with format guide and placeholder value
- `.prettierignore` — (modified) add `prisma/migrations/` and `src/generated/` exclusions
- `README.md` — (modified) add "Database setup" section, extend scripts table, add `prisma/` and `docs/` to folder structure, link `docs/DATABASE.md`

---

## Patterns to follow

- **Naming:** `camelCase` for functions and variables; `PascalCase` for TypeScript types,
  interfaces, and Prisma model names; `SCREAMING_SNAKE_CASE` for enum values (e.g.
  `DRAFT`, `PUBLISHED`, `GOOGLE`); `kebab-case` for file and directory names.
- **Error handling:** Prisma errors bubble to the caller — no silent swallowing. In seed
  scripts, catch at the top-level `main()` boundary and `process.exit(1)` on failure.
  Integration tests assert on Prisma error codes (`P2002`, `P2003`) rather than on raw
  Postgres codes where possible.
- **Async style:** `async/await` throughout. No callbacks, no bare `.then()` chains.
  `spawnSync` is acceptable in test files for invoking CLI commands (migrate, seed).
- **Testing style:** Vitest with Jest-compatible API (`describe`, `it`, `expect`).
  Arrange / Act / Assert inside each `it`. Integration tests use
  `describe.skipIf(!process.env.DATABASE_URL)` at file level to no-op when no DB is
  configured. `beforeAll`/`afterAll` for migration and schema setup; `beforeEach`/`afterEach`
  plus `truncateAll()` for row-level isolation between tests. Seed tests use a full
  `resetDatabase()` before seeding so row counts are deterministic.
- **Module imports:** Use the `@/` alias for application code cross-directory imports
  (e.g. `import { prisma } from "@/lib/db"`). Seed script uses a relative path
  (`"../src/lib/db"`) because it runs outside the Next.js module graph. Test helpers
  may use relative imports within `prisma/__tests__/`.
- **Prisma client:** Never instantiate `new PrismaClient()` in application code or seed —
  always use the singleton from `src/lib/db.ts`. The only permitted exception is
  `prisma/__tests__/helpers/testDb.ts`.

---

## Utilities to reuse

- `src/lib/db.ts::prisma` — The singleton Prisma client. Import as
  `import { prisma } from "@/lib/db"` in application code,
  `import { prisma } from "../src/lib/db"` in `prisma/seed.ts`.
- `prisma/__tests__/helpers/testDb.ts::testPrisma` — Prisma client for integration tests.
- `prisma/__tests__/helpers/testDb.ts::resetDatabase()` — Drop + re-apply all migrations.
  Use in `beforeAll`/`afterAll`.
- `prisma/__tests__/helpers/testDb.ts::truncateAll()` — Truncate all rows with identity
  reset. Use in `beforeEach`/`afterEach` for fast inter-test isolation.
- `@prisma/client::Prisma.dmmf.datamodel` — Static introspection of the generated schema
  (model names, field names, `isRequired`, unique indexes). Use in unit tests to avoid a
  live DB. Import as `import { Prisma } from "@prisma/client"`.
- `child_process::spawnSync` — For CLI invocations (`prisma migrate deploy`, `prisma db
  seed`) inside integration tests. Set `{ encoding: "utf8", stdio: "pipe" }` and check
  `.status === 0`.

---

## Anti-patterns in this codebase

- **Do not call `new PrismaClient()` in application code.** Only `src/lib/db.ts` and
  `prisma/__tests__/helpers/testDb.ts` may instantiate it. A second instance in hot-reload
  environments exhausts DB connection pools.
- **Do not import `@prisma/client` directly in application code for queries.** Always go
  through `@/lib/db`.
- **Do not add a `password` or `passwordHash` column to `Teacher`.** Auth credentials
  are out of scope for this ticket; the `Identity` model handles OAuth linkage.
- **Do not add a `Save`, `Bookmark`, or `SavedResource` model.** Saved resources are
  represented solely via `BoardItem`.
- **Do not add `downloads` or `termsAcceptance` tables.** These are owned by issues #11
  and #12 and will arrive in their own migrations.
- **Do not open a database connection in `src/lib/db.ts` at module load time.** No
  top-level `await`, no `prisma.$connect()`. Connections must be lazy so `npm run build`
  and `npm test` work without `DATABASE_URL`.
- **Do not call `db:seed` or `prisma db seed` from within `npm test`.** Seeding is only
  triggered by `npm run db:seed` or `db:reset`. The default `npm test` path must stay
  DB-free for machines without PostgreSQL.
- **Do not add GIN/GiST full-text indexes.** Phase 2 (#17) owns full-text search. Use
  only `contains` + `mode: "insensitive"` for MVP keyword search.
- **Do not modify `src/app/api/health/route.ts`.** The health route must stay
  database-free; it must never import Prisma.
- **Do not add a GitHub Actions workflow file.** CI provisioning is out of scope for this
  ticket.
- **Do not use lodash or other utility libraries.** The project has no such dependency.

---

## Repo commands (verified at contract-write time)

- **Test (all, includes integration if `DATABASE_URL` set):** `npm test`
- **Test (fast subset, unit only, no DB):**
  `npx vitest run prisma/__tests__/schema.unit.test.ts src/__tests__/env-config.test.ts`
- **Test (schema + migration subset):**
  `npx vitest run prisma/__tests__ src/__tests__/env-config.test.ts src/__tests__/scripts.test.ts`
- **Lint:** `npm run lint`
- **Format check:** `npm run format:check`
- **Type check:** `npx tsc --noEmit`
- **Build (no DB required):** `npm run build`
- **Generate Prisma client (no DB required):** `npm run prisma:generate`
- **Apply migrations (requires `DATABASE_URL`):** `npm run db:migrate`
- **Seed (requires migrated DB):** `npm run db:seed`
- **Reset (drop + migrate + seed, requires `DATABASE_URL`):** `npm run db:reset`

> After adding Prisma deps, run `npm install` first. The `postinstall` script will
> auto-run `prisma generate`.

---

## Vitest test discovery note

The existing `vitest.config.ts` uses no explicit `include` pattern — Vitest's default
glob discovers `**/*.{test,spec}.ts` anywhere in the project tree. New test files under
`prisma/__tests__/` will be discovered automatically without changing `vitest.config.ts`.
Integration tests that require `DATABASE_URL` must guard themselves with
`describe.skipIf(!process.env.DATABASE_URL)(...)` so `npm test` remains green on
machines without PostgreSQL.
