# [MVP] Implement subject and year-level taxonomy tagging

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/5

## Problem
Teachers come to Teacher Hub to find classroom materials that fit a specific
teaching context — a subject (e.g. Mathematics) and a year/grade level (e.g.
High School). Without a standardized way to tag resources, materials cannot be
reliably organized or filtered, so teachers would have to scan everything to
find anything relevant. This defeats the platform's core promise of finding
useful content "in minutes, not hours."

This ticket establishes the **taxonomy foundation**: a controlled vocabulary of
approved subjects and year levels, plus the rules that every resource must be
tagged from that vocabulary. It underpins the upload flow (#4) and the
search/browse experience (#6), both of which reference subject and year level.

> Confidence for this section: ⚠️ **Inferred** — the platform's discovery goal
> is stated in the README and sibling issues (#4, #6), but no resource or
> tagging code exists yet in the repo (`src/` currently contains only a health
> endpoint and the app skeleton). See "Needs clarification."

## Impact
- **Users affected:** All teachers (every content creator and every content
  consumer). ⚠️ Inferred — the whole user base depends on discovery.
- **Severity:** high — discovery (#6) and upload metadata (#4) are blocked or
  degraded without an agreed taxonomy. ⚠️ Inferred from sibling issue
  dependencies.
- **Frequency:** always — tagging is applied on every resource creation and used
  on every browse/filter action. ⚠️ Inferred.

## Success criteria
- A controlled, versionable set of approved **subjects** and **year levels**
  exists and is the single source of truth for tagging. ✅ Verified as a
  requirement — mirrored by issue #3 (schema includes `subjects` and
  `year levels` tables) and #4 (resource has subject + year level).
- A teacher creating a resource can only select subject/year-level values that
  belong to the approved taxonomy. ✅ Verified requirement (#4, #5).
- A teacher browsing resources can narrow results by subject and/or year level
  and gets an accurate result set. ✅ Verified requirement (#6 AC: "filter
  results by subject and year level").
- Invalid or unknown tag values are rejected by the API before persistence.
  ✅ Verified requirement (#5).

## Acceptance criteria
- [ ] An approved taxonomy of **subjects** and an approved taxonomy of **year
      levels** exist as reference data, each entry having a stable identifier
      and a human-readable display label. ✅ (aligned with #3)
- [ ] The taxonomy reference data is retrievable by the application (e.g. so
      creation and filter UIs can present the approved options). ⚠️ Inferred —
      no delivery mechanism exists yet; exact transport is a solution detail.
- [ ] Creating a resource **requires** a subject selection and a year-level
      selection; a submission missing either is rejected. ✅ (#4, #5)
- [ ] The API rejects any resource create/update whose subject or year-level
      value is not part of the approved taxonomy, returning a clear validation
      error rather than silently accepting or dropping it. ✅ (#5)
- [ ] Editing an existing resource re-validates subject and year level against
      the same taxonomy, so tags stay within the approved set after edits. ✅ (#5)
- [ ] Resource cards and resource detail views display the resource's subject
      and year-level tags in a clearly readable way. ✅ (#5) — ⚠️ depends on
      resource UI delivered by #4 existing; see edge cases.
- [ ] Filtering a resource listing by a subject and/or a year level returns only
      resources tagged with the selected value(s), and clearing the filter
      restores the full set. ✅ (#5, #6)
- [ ] Seed/reference data for the MVP taxonomy is available for local
      development and QA. ✅ (aligned with #3 seed-data AC and #17 which assumes
      seed taxonomy values exist).

## Edge cases & non-functional
- **Empty/no-match filters:** filtering by a subject or year level with no
  matching resources must produce a clear no-results state (owned by #6, but the
  taxonomy must not break it).
- **Backward compatibility / extensibility:** the taxonomy model must allow new
  values to be added later without breaking existing resource classifications —
  Phase 2 issue #17 will add university levels and expects "existing
  primary/secondary data remains compatible" and a migration path. Design the
  vocabulary so additive changes are non-breaking. ✅ (#17)
- **Referential integrity:** a resource must not be able to reference a
  subject/year-level value that does not exist; removing/renaming a taxonomy
  value must not orphan or silently mistag resources. ✅ (aligned with #3 FK/
  constraint AC).
- **Consistency of display labels:** the label shown on cards, detail pages, and
  filters must come from the single taxonomy source so naming stays consistent
  everywhere. ⚠️ Inferred.
- **Accessibility:** tag chips and filter controls should be perceivable and
  operable (labels, contrast, keyboard) consistent with the rest of the UI.
  ⚠️ Inferred (no a11y convention documented in repo yet).
- **i18n / regional wording:** subject names and especially year-level naming
  are region-specific (e.g. "High School" vs "Secondary", grade numbers vs key
  stages). MVP scope of regional support is unresolved — see Ambiguity 2.

## Out of scope
- Building the PDF upload workflow itself (owned by **#4**); this ticket only
  supplies the taxonomy and validation those flows consume.
- Building the full search/browse UI, pagination, keyword search, and sorting
  (owned by **#6**); this ticket only guarantees subject/year-level filtering is
  possible and correct.
- Designing the underlying database schema and migrations (owned by **#3**);
  this ticket defines the taxonomy at the product level, not the DDL.
- University-level taxonomy and any taxonomy expansion (owned by Phase 2 **#17**).
- An end-user or admin **UI for editing the taxonomy itself** — see Ambiguity 1;
  MVP proposes fixed, seeded reference data with no admin CRUD screen.

## References
- Original ticket: https://github.com/CarlosCunha99/teacher-hub/issues/5
- Related: #3 (PostgreSQL schema — subjects & year-level tables, seed data)
- Related: #4 (PDF upload — resource requires subject + year level)
- Related: #6 (search & browse — filter by subject and year level)
- Related (Phase 2): #17 (extend taxonomy to university levels)
- README.md (tech stack, folder structure, MVP feature list)

## Raw context used
- `.orchestration/tickets/5/raw-context.md` — contained only the empty intake
  template; **no additional context was provided.** All enrichment below is
  derived from the original issue, sibling GitHub issues (#3, #4, #6, #17), and
  the current repository state.

## Enrichment notes
- The repository is currently a **bare Next.js skeleton** (only `src/app`,
  `src/lib/health.ts`, and config/test scaffolding exist). There is **no
  resource entity, no database, and no tagging code today**, so every "current
  behavior" statement is necessarily about intended future behavior, not
  something already implemented. This ticket is a greenfield foundation that
  several siblings depend on.
- Sequencing observation for the human at the gate: parts of the visible ACs
  (displaying tags on cards, filtering result sets) structurally depend on
  resource storage (#3) and resource UI (#4/#6) existing. The taxonomy +
  validation core is independently deliverable; the display/filter ACs may need
  those siblings first. Flagged, not resolved (a product/sequencing call).
- **Ambiguity 1 — Taxonomy management scope.** The original AC says the
  reference data "can be managed for MVP." Proposed reading: for MVP the
  taxonomy is a **fixed, seeded controlled vocabulary** (add/change values via
  seed/migration, no runtime admin UI). Alternative rejected for MVP: a full
  admin CRUD screen for editing taxonomy (heavier, and #17 treats admin/seed
  data as the source). blocking: no
- **Ambiguity 2 — Year-level scheme & regional wording.** The issue gives
  US-style examples ("Elementary, Middle School, High School") while #17 uses
  "primary/secondary." The exact MVP list and regional convention are
  unspecified. Proposed reading: adopt a small, explicit MVP set using the
  issue's own examples (Elementary / Middle School / High School) as display
  labels, backed by stable identifiers so labels can change without data
  migration. Alternatives (grade numbers, key stages, multi-region) deferred.
  blocking: no
- **Ambiguity 3 — Tag cardinality.** Unspecified whether a resource has exactly
  one subject and one year level, or may have several (e.g. a cross-curricular
  resource, or a resource spanning multiple grades). Proposed reading: MVP
  requires **at least one** subject and **at least one** year level per
  resource, allowing multiple, since teaching materials commonly span grades/
  subjects. Alternative: strict single-select. This changes how the "requires
  valid selection" and "filter returns accurate set" ACs are tested.
  blocking: no

## Needs clarification
The following are **not verified against repo evidence** and should be confirmed
by the human before brainstorming/planning:
1. ⚠️ **Taxonomy management scope** (Ambiguity 1) — fixed seeded vocabulary vs.
   runtime admin editing for MVP. Recommended default: fixed/seeded.
2. ⚠️ **Year-level scheme & regional wording** (Ambiguity 2) — confirm the exact
   MVP list and whether US-style labels are acceptable.
3. ⚠️ **Tag cardinality** (Ambiguity 3) — single vs. multiple subjects/year
   levels per resource. Materially affects AC test design.
4. ❓ **Sequencing** — whether the display/filter ACs are expected to land in
   this ticket or to be satisfied once #3/#4/#6 exist, given the repo is
   currently a skeleton.

**Recommendation to orchestrator:** these are product decisions, not solution
details. Surfacing them at the gate (rather than resolving them unilaterally)
will keep the acceptance criteria correct. None hard-block drafting, but items 1
and 3 should be confirmed before ACs are frozen for planning.

---
## Original
```
# [MVP] Implement subject and year-level taxonomy tagging

## User Story
As a teacher, I want resources tagged by subject and year level so that I can quickly find materials relevant to my classroom context.

## Scope
Define and enforce standardized subject and school year/grade tagging in creation and discovery flows.

## Acceptance Criteria
- [ ] Subject and year-level reference data exists and can be managed for MVP.
- [ ] Resource creation requires valid subject and year-level selections.
- [ ] APIs reject tags that are not part of the approved taxonomy.
- [ ] Resource cards and detail pages show subject and year-level tags clearly.
- [ ] Filtering by subject and year level returns accurate result sets.
- [ ] Tagging remains consistent after edits to existing resources.

## Context
This is an MVP feature for organizing educational resources by subject (e.g., Mathematics, English, Science) and year level (e.g., Elementary, Middle School, High School). The task involves building taxonomy management, enforcing validation at API and UI levels, and implementing discovery filters.
```
