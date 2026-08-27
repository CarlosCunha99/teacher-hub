# Brainstorm — resource-tagging

<!-- Transcript of the solution direction conversation -->

### 2026-08-27 22:10 — dev (autopilot mode)
Brainstorming the approach for custom tags. Here's my initial thinking:

We need a many-to-many relationship between resources and tags, where tags are owned
by a teacher. The standard taxonomy from issue #5 uses a different model (predefined
reference data), so custom tags should be a separate `Tag` model. Each Tag has a name,
a slug (kebab-case derived from name), an owner (teacher), and a createdAt.

For the resource-tag join, a `ResourceTag` table (or Prisma many-to-many) links
resources to tags. The filter query is a straightforward WHERE EXISTS / JOIN on the
ResourceTag table.

Auth is the tricky bit — we don't have real auth yet (#2 is still planned). I'm
thinking we stub it with an `X-Teacher-Id` header for now, injecting it into a
request context. The real auth integration is a follow-up.

For the persistence layer: the project README mentions PostgreSQL (issue #3) but
there's no ORM installed yet. Prisma with SQLite (for local/dev) mapping to
PostgreSQL in prod feels right — it's what most Next.js projects use and it's what
issue #3 implies. SQLite keeps CI simple.

The API design should match Next.js App Router conventions already in the codebase
(route handlers, named exports for HTTP verbs).

What do you think — does teacher-scoped tags feel right, or should tags be global
with attribution? Also, Prisma/SQLite vs something simpler like a JSON file store?

### 2026-08-27 22:11 — agent
Teacher-scoped tags feel right. Global tags with attribution risk two problems:
1. Name pollution — teacher A's "STEM Challenge" tag appears in teacher B's filter
   results even when B has never used it.
2. Delete semantics — if tags are global, deleting a tag you created affects other
   people's resources silently.

The ticket ACs explicitly say "no shared global tag namespace," so teacher-scoped is
the only safe design.

On Prisma/SQLite: that's the right call. The `raw-context.md` confirms issue #3 targets
PostgreSQL; Prisma is the natural bridge. SQLite as the dev/CI target keeps the test
suite self-contained (no Postgres container required). The Prisma schema can be written
once and pointed at Postgres in production by swapping one env var.

One thing to probe: how do you want to handle the `Resource` model? We need at minimum
a `Resource` table to attach tags to. Do you want a minimal stub (just id + teacherId)
for this ticket, or do you want to model the full resource entity (title, subject, yearLevel,
fileUrl, etc.) now so the schema is coherent?

### 2026-08-27 22:12 — dev (autopilot mode)
Good point on delete semantics — teacher-scoped it is.

For the Resource model: let's go with a minimal-but-realistic stub. Include id,
teacherId, title, and createdAt. Subject/yearLevel tags are out of scope here
(that's issue #5). The schema just needs to be coherent enough that custom tags
can attach to it and the filter query works.

Also, let's keep the API surface thin but complete: CRUD on tags, assign/unassign
to resources, and filter resources by tags. No pagination on tag lists, no tag
search, no UI components (API-only for this ticket).

Let's go with this.

### 2026-08-27 22:12 — agent
Makes sense — minimal Resource stub with id/teacherId/title/createdAt, Prisma +
SQLite, teacher-scoped tags, API-only. That's a clean, testable scope.

