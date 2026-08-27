# Brainstorm — issue-3

## Direction summary

**Orchestrator (autopilot) synthesized approach from enriched ticket and implementation notes:**

Given that:
1. The ticket specifies Prisma ORM + PostgreSQL explicitly
2. Acceptance criteria are well-defined for 7 entity groups (users, resources, subjects/year-levels, boards, likes, saved relationships)
3. Downstream issues #4–#8 have strict data-shape dependencies
4. MVP scale does not require advanced horizontal scaling or event sourcing

**Agreed direction:**
- Single Prisma schema file (`prisma/schema.prisma`) with all 7–9 entities
- PostgreSQL foreign keys + unique constraints for referential integrity (no application-level checking)
- Indexes on: (owner_id, created_at) for feed ordering; (subject_id, year_level_id) for filtering; (title, description) for full-text search prep; (resource_id, teacher_id) for like/save lookups
- Soft-delete on resources only (cascade on others per analysis below); tombstone behavior documented for downstream #4–#8
- `prisma/seed.ts` fixture script covering 5 teachers, ~20 resources across 3 subjects × 3 year levels, boards with items, likes
- DAL docs in `docs/DATABASE.md` with query patterns for feed, search, profile
- Migrations run in CI; seed only in dev/QA

## Rationale

This approach:
- Unblocks all downstream MVP issues (#4–#8) without requiring them to guess at schema
- Leverages Prisma type safety so #4–#8 can't accidentally store invalid relationships
- Makes index performance decisions up front so search (#6) and feed (#8) are fast
- Uses industry-standard PostgreSQL + Prisma idioms so no esoteric knowledge required
- Allows clean rollback and replay in dev/QA

## Confirmed scope

IN scope:
- Core MVP entity definitions (users, resources, subjects/year-levels, boards, board items, likes, saves)
- Referential integrity via foreign keys
- Indexes for access patterns in #4–#8, #6, #8
- Migration + seed infrastructure
- DAL conventions doc

OUT of scope:
- Phase 2 entities (#15–#18): university level, tags, advanced search, download tracking, audit logs
- Authentication implementation (issue #2)
- API route logic (issues #4–#8)
- UI/UX (issues #7–#8, #10)
- Replication, backup, disaster recovery
- Full-text search indexes (prep only; actual FTS in Phase 2 #17)

