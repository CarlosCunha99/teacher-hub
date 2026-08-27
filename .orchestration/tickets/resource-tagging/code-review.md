# Code Review

## Verdict
**approve**

## Summary
The custom resource-tagging implementation is clean, small, and matches the locked
contract closely. Auth (X-Teacher-Id), ownership checks, slug generation, the P2002
conflict path, and the OR/AND filter mapping are all implemented correctly. No
correctness, security, or contract-violating defects that would ship the feature
broken. One documentation inaccuracy and a few low-severity edges are worth fixing but
none are blocking.

## Blocking findings
None.

## Important findings

### I-1 — README claims a false Postgres migration path
`README.md` (Database → Production) states:
> "No code changes are required — Prisma reads `DATABASE_URL` at runtime and the same
> migrations apply to PostgreSQL."

This is inaccurate and will bite whoever does the Postgres cutover:
- `prisma/schema.prisma` hardcodes `provider = "sqlite"` and
  `prisma/migrations/migration_lock.toml` is pinned to `sqlite`. Prisma refuses to run
  SQLite-generated migrations against a Postgres datasource without changing the
  provider and regenerating the migration history.
- The generated SQL (`DATETIME ... DEFAULT CURRENT_TIMESTAMP`) is SQLite-flavoured, not
  portable Postgres DDL.

The *schema models* are portable, but "no code changes / same migrations apply" is
false. This is a doc-accuracy defect, not a code bug. Recommend rewording to: change
the provider to `postgresql`, delete/regenerate migrations (or `prisma migrate dev`
against Postgres), then set `DATABASE_URL`. **Severity: Important (docs).**

### I-2 — Client-trusted `X-Teacher-Id` is fully deployable to production
`getTeacherId` trusts the raw request header as the authenticated identity with no
guard. In production this means any caller can impersonate any teacher and read/mutate
their tags and resources by setting a header. This is explicitly an intentional,
documented stub (ticket enrichment note + README + verify.md) blocked on issue #2, so
it is not treated as a blocking security finding *for this ticket*. Flagging so it is
not lost: there is nothing in code (e.g. a `NODE_ENV === "production"` refusal) that
prevents the stub from silently shipping to a real deployment. Consider a follow-up
guard or a loud startup warning. **Severity: Important (known risk).**

## Suggestions

### S-1 — Non-atomic detach can 500 under concurrent delete
`resources/[id]/tags` DELETE does `findUnique` → `delete` on `ResourceTag`
non-atomically. If two requests detach the same association concurrently, the second
`prisma.resourceTag.delete` throws `P2025` (record not found), which is uncaught and
surfaces as a 500 instead of the contract's 404. Low probability; consider catching
P2025 → 404, or using `deleteMany` and treating `count === 0` as 404.

### S-2 — Empty `mode=` query treated as default OR
In `resources` GET, `?mode=` yields an empty string, which is falsy, so validation is
skipped and it defaults to `"or"`. Contract says non-`or`/`and` values → 400. An empty
`mode` is arguably "present but invalid." Harmless in practice; note only.

### S-3 — Redundant explicit cascade on tag delete
`tags/[id]` DELETE runs `resourceTag.deleteMany` before `tag.delete`, but the schema
already declares `onDelete: Cascade` on the `ResourceTag.tag` relation, so the manual
delete is redundant. Not wrong, and it makes the intent explicit; leave or remove at
author's discretion.

## Contract adherence
- Data shapes, status codes, and auth/error semantics match the contract.
- Error envelope: contract locks `ErrorResponse { error: string }` and notes a
  machine-readable key is "not required at MVP." The implementation returns
  `{ error, code }`. This is an **additive** field (superset), not a violation —
  JSON consumers asserting `error` are unaffected. Acceptable; noting for the record.
- P2002 handling in POST `/api/tags`: the only unique constraint reachable in `tag.create`
  is `@@unique([teacherId, slug])` (the `id` is a cuid). The `ResourceTag`
  unique constraint lives in a different endpoint, so a stray P2002 cannot leak into the
  tag-create 409 path. The 409 mapping is correct.
- Filter mapping: OR uses `slug: { in: slugs }`, AND uses one `some` clause per slug
  under `AND`. Unknown slugs correctly yield no match (do not widen OR, empty AND).
  Matches locked filter semantics.
- Idempotent attach via `upsert` on `resourceId_tagId` → 201; detach missing
  association → 404; DELETE tag → 200 `{ success: true }`. All per resolved
  ambiguities R-1..R-7.

## Requirements coverage
- Create/list/delete teacher-scoped tags with per-teacher isolation: covered
  (`where: { teacherId }`, `@@unique([teacherId, slug])`).
- Attach/detach with ownership enforcement (resource + tag on attach; resource on
  detach): covered; rejects with 403, not silent no-op.
- Public filtering by one/many slugs with OR/AND: covered and composable
  (additional `where` clauses can be AND-ed later).
- Slug determinism + per-teacher uniqueness with 409 collision: covered.
- Name trim + empty rejection: covered in route and `toSlug`.
- Cascade on tag delete and resource delete: covered via schema `onDelete: Cascade`.

## Notes
Did not run tests/lint/build (out of scope for this review); verify.md reports
74/74 tests, clean lint/type/build. Findings above are static-analysis only.
