# [Phase 2] Add resource tagging and filtering by custom categories

**Type:** feature
**Source:** text-only (session description; closest GH issue: #5 for standard taxonomy MVP)

## Problem

Teachers use the platform to share and discover classroom resources. The standard
subject/year-level taxonomy (issue #5) covers common filtering needs, but teachers
working on niche interdisciplinary topics, institutional curricula, or highly
specialised subject areas cannot adequately describe their resources with the
pre-defined subject/year tags alone.

Phase 2 expands the tagging model so teachers can attach free-form custom tags
(e.g. "STEM Challenge", "AQA Specification", "Block 3 Unit 2") to any resource they
own. These custom tags are searchable and filterable, letting other teachers quickly
find resources that match both the standard taxonomy *and* institutional/niche
categories they care about.

## Impact
- Users affected: all teachers who upload resources and want richer discovery
- Severity: medium (standard taxonomy still works; this is an improvement to discovery)
- Frequency: often — any teacher with niche materials or institutional needs will hit this

## Success criteria
- A teacher can create, view, and delete their own custom tags via the API.
- A teacher can assign one or more custom tags to a resource they own.
- Resources can be filtered by custom tag slug(s) alongside or independently of the
  standard subject/year taxonomy.
- Custom tags are scoped to the resource owner (teacher); no global tag pollution.
- The API surface is documented and consistent with existing route conventions.

## Acceptance criteria
- [ ] `POST /api/tags` creates a new custom tag (name, slug) for the authenticated teacher.
- [ ] `GET /api/tags` lists all custom tags belonging to the authenticated teacher.
- [ ] `DELETE /api/tags/:id` deletes a custom tag owned by the teacher; cascades from resources.
- [ ] `POST /api/resources/:id/tags` assigns an existing tag to a resource (teacher must own resource).
- [ ] `DELETE /api/resources/:id/tags/:tagId` removes a tag from a resource.
- [ ] `GET /api/resources?tags=slug1,slug2` filters resources by custom tag slugs (AND or OR configurable, default OR).
- [ ] Tags are persisted across requests (database-backed, not in-memory).
- [ ] Slug is auto-generated from name (kebab-case, de-duplicated per teacher).
- [ ] API returns 401 for unauthenticated requests; 403 when teacher does not own the resource or tag.
- [ ] All new endpoints have unit tests covering happy paths and key error cases.

## Edge cases & non-functional
- Two teachers can use the same tag name independently (tags are teacher-scoped).
- Deleting a tag cascades and removes all resource-tag associations for that tag.
- A resource can have 0 or more custom tags; no upper limit enforced at MVP.
- Slug uniqueness is enforced per-teacher (not globally).
- Tag names are trimmed and lowercased before slug generation.
- Filter by multiple tags defaults to OR semantics; `?mode=and` switches to AND.
- No pagination required for the tag list (teachers are unlikely to have >100 custom tags at MVP).

## Out of scope
- Global/shared tag taxonomy — tags are private to each teacher.
- Tag merging or renaming UI.
- Full-text search over tag names.
- Teacher-to-teacher tag following or discovery.

## References
- Issue #5: [MVP] Implement subject and year-level taxonomy tagging (standard taxonomy)
- Issue #3: [MVP] Design PostgreSQL schema (DB conventions)
- Session description: "Allow teachers to create and use custom tags/categories for organizing resources beyond the standard subject/year taxonomy."

## Raw context used
- Issue #5 body and acceptance criteria (confirms standard taxonomy covers subjects/year levels; this ticket adds free-form custom layer)
- Issue #3 body (PostgreSQL schema; Prisma conventions expected)
- Repo codebase: Next.js 15 App Router, TypeScript, Vitest, no ORM yet installed

## Enrichment notes
- **Ambiguity:** Authentication mechanism not yet implemented (issue #2 is still planned). For this feature implementation we will stub auth with a simple header-based fake (`X-Teacher-Id`) so the API is functionally correct and testable; the real auth hook-up is tracked as a follow-up. blocking: no
- **Ambiguity:** No database is set up yet. We will install Prisma with SQLite for local development, mirroring the PostgreSQL target described in issue #3. blocking: no

---
## Original
User request: "Allow teachers to create and use custom tags/categories for organizing resources beyond the standard subject/year taxonomy. This adds flexibility for niche topics and institutional needs."
