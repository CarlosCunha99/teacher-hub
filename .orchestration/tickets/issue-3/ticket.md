# [MVP] Design PostgreSQL schema for users, resources, tags, boards, and interactions

**Issue:** #3  
**Labels:** enhancement, mvp  
**Author:** CarlosCunha99 (Carlos Cunha)

## User Story

As a teacher, I want resources and collections to be stored in a consistent data model so that information is accurate, searchable, and scalable.

## Scope

Define MVP relational schema and migrations for core entities and relationships.

## Acceptance Criteria

- [ ] PostgreSQL schema includes tables for users, resources, subjects, year levels, boards, board items, likes, and saved relationships.
- [ ] Foreign keys and constraints enforce referential integrity.
- [ ] Indexes are added for frequent lookup patterns (search filters, feed ordering, user profile lookups).
- [ ] Initial migration(s) can be applied and rolled back successfully.
- [ ] Seed data script exists for local development and QA scenarios.
- [ ] Data access layer conventions are documented for API route usage.

## Context

- Issue #1 (Next.js foundation) is merged.
- Issue #2 (auth) will establish the user account model before this ships, so we can assume the users table structure from issue #2: `id, email, password_hash, name, created_at`.
- This is the database foundation for the entire platform.

## Implementation Notes

1. Use Prisma ORM + PostgreSQL for type-safe database access.
2. Create a Prisma schema file (`prisma/schema.prisma`) with all tables and relationships.
3. Create migrations using `prisma migrate` for local dev and CI.
4. Seed data with `prisma/seed.ts` for development fixtures.
5. Document how future issues #4-#11 will use the DAL (data access layer).
6. Write comprehensive tests to verify schema integrity and migrations.

Once complete, open a PR for review.
