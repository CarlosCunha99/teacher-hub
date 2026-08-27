# Solution: Seed-driven taxonomy with many-to-many tagging

## Direction

The taxonomy (subjects and year levels) will be defined as hardcoded seed data — a fixed, controlled vocabulary loaded via migration. Subjects cover: Math, English, Science, Social Studies, Arts, and Physical Education. Year levels cover: Elementary, Middle School, and High School. No admin UI is in scope; changing the taxonomy requires a migration and redeployment.

Resources carry many-to-many relationships to both subjects and year levels, since teaching materials commonly span multiple grades or topics. At least one subject and one year level is required per resource.

Taxonomy values are exposed to the front-end via a read-only API endpoint (e.g. GET /api/taxonomy), which returns the full approved set of subjects and year levels. This allows creation and filter UIs to populate dropdowns from the single authoritative source.

Validation is enforced in the service layer on every resource create and update. Any subject or year-level ID not present in the approved taxonomy is rejected with a clear error before persistence. Filtering follows an OR-within-dimension, AND-across-dimensions pattern: selecting "Math" and "High School" returns resources tagged with Math AND tagged with High School, but also tagged with other subjects or year levels.

## Key decisions

- Decided to use hardcoded seed data (not runtime admin UI) because MVP scope is minimal and #17 already treats seed data as the source of truth.
- Decided on many-to-many cardinality (not single-select) because cross-curricular and multi-grade materials are a real use case, and this matches the enriched ticket's ambiguity-3 resolution.
- Decided to expose a read-only taxonomy API endpoint so the front-end has a single source of truth for populating dropdowns and display labels.
- Decided OR-within-dimension AND-across-dimensions filtering because it is a standard, intuitive filter pattern and keeps MVP scope contained.
- Decided US-style year-level labels (Elementary / Middle School / High School) backed by stable identifiers so labels can change later without data migration.

## Explicitly rejected

- Admin CRUD UI for taxonomy management: too heavy for MVP; deferred to Phase 2 or later.
- Strict single-select per resource: rejected because cross-curricular/multi-grade resources are common and the many-to-many model is more defensible.
- Full AND-across-all-tags filtering (every selected value must match): rejected in favour of the OR-within-dimension pattern as being more intuitive for browsing.

## Open questions

- None. All three ambiguities from the enriched ticket (taxonomy management scope, year-level labels, tag cardinality) were resolved during brainstorming.
