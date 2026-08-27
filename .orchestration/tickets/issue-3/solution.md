# Solution: Prisma + PostgreSQL MVP schema for teacher-hub

## Direction

The MVP persistence layer will use Prisma ORM with PostgreSQL to define a single, shared schema covering all teacher-hub core entities: teachers/users, resources, subject/year-level taxonomies, boards, board items, likes, and saved relationships. Prisma's type-safe schema and migrations provide a single source of truth for downstream features (#4–#8).

The schema enforces referential integrity via PostgreSQL foreign keys and unique constraints at the database level, not just in application code — preventing invalid data even if an API route has a bug. Indexes will be strategically placed on access patterns used by search (#6), feed ordering (#8), and profile lookups (#8) to ensure queries remain fast as the MVP scales.

Migrations will run automatically in CI and locally via `prisma migrate`. A seed script (`prisma/seed.ts`) will populate development and QA databases with realistic fixture data: multiple teachers, resources spread across subjects and year levels, boards with saved items, and likes. Data access conventions will be documented in a DAL guide so issues #4–#8 follow a consistent pattern.

## Key decisions

- **Prisma ORM + PostgreSQL:** Type safety, standardized migrations, integrates with Next.js easily, matches existing tech stack intent (Node.js/TypeScript).
- **Single schema file:** All entities in one `schema.prisma` so downstream PRs can see the full shape without jumping between files.
- **Database-level constraints:** Foreign keys and unique indexes on (resource_id, teacher_id) for likes and (resource_id, board_id, teacher_id) for board items prevent accidental duplicates.
- **Soft-delete on resources only:** Resources are tombstoned when deleted (retain view history in #8); likes and board entries cascade so the platform remains consistent.
- **Indexes on access patterns:** (owner_id, created_at) for feed; (subject_id, year_level_id, created_at) for filtered discovery; titles/descriptions for search prep.
- **Fixture-based seeding:** A deterministic seed script makes local dev and QA reproducible and matches MVP complexity.

## Explicitly rejected

- **Separate data warehouse or cache tier:** Not needed in MVP; PostgreSQL alone is fast enough for expected load.
- **Full-text search indexes:** Deferred to Phase 2 (#17); prep the schema to support it, but don't implement it yet.
- **Sharding or multi-tenant isolation:** No multi-tenancy required; simple tenant is the platform itself.
- **Event sourcing or audit logs:** Not required by ACs; can add in Phase 2 if needed.

## Open questions

None — brainstorm converged on the above direction.

