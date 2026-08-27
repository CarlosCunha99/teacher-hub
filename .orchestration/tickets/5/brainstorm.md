# Brainstorm Transcript — Issue #5

Brainstorming open for [MVP] Implement subject and year-level taxonomy tagging.
The enriched ticket is at `.orchestration/tickets/5/ticket.md`.

Share your thinking on the approach and I'll poke at it. When you're ready to lock it in, say 'let's go with this' (or similar).

---


### 2026-08-27 21:57 — developer
Given the MVP scope and the fact that #3 handles schema design, here's my thinking:

The taxonomy should be simple for MVP — a hardcoded seed data file (JSON or SQL) that defines the subjects and year levels. No admin UI. The seed includes:
- Subjects: Math, English, Science, Social Studies, Arts, Physical Education
- Year levels: Elementary, Middle School, High School

At the API level, when creating/updating a resource, we validate subject and year-level IDs against what's in the seed. The validation happens in the service layer.

For display and filtering, resources have subject_id and year_level_id fields (or arrays if we go multi-select). The front-end queries with those IDs and displays the human-readable labels.

Thoughts on this structure, edge cases, or constraints I'm missing?

### 2026-08-27 21:57 — agent
That's a solid foundation. A few quick checks:

1. You mentioned subject and year-level IDs. Do you envision this as a single ID pair per resource, or allowing multiple subjects/year levels per resource (since some materials span grades/topics)?
2. Validation at the service layer makes sense. How does the front-end get the seed taxonomy to populate the dropdowns during resource creation?
3. The seed approach sidesteps an admin UI for MVP. Does that align with what you think is reasonable for an MVP, or do you see issues with that constraint?

### 2026-08-27 21:57 — developer
Good points. Let me refine:

1. Multiple: a resource can have multiple subjects and multiple year levels. The relationship is many-to-many (resource_id -> subject_id, resource_id -> year_level_id). That's more flexible and matches reality (cross-curricular materials, multi-grade resources).

2. The front-end needs a way to fetch the approved taxonomy. That's a simple read-only API endpoint that returns the full set of subjects and year levels. Call it GET /api/taxonomy or similar. Could be cached.

3. MVP constraint: seeded data only, no admin editing. Phase 2 or later can add the admin UI. For now, data changes require a migration/redeployment.

Sound reasonable?

### 2026-08-27 21:57 — agent
Yep. Many-to-many is more defensible and aligns with the enriched ticket's ambiguity 3 resolution. Taxonomy API endpoint makes sense — keeps concerns clean.

One more thing: filtering. When a user filters by subject "Math", does the query return resources tagged with Math plus any other subject, or only Math? Or is it an AND/OR mode?

### 2026-08-27 21:57 — developer
Good catch. For MVP, I'd go with OR — filter by "Math" returns all resources with Math, regardless of other tags. Same for year level. If the user selects both "Math" and "High School", it should return resources that have (Math in subjects) AND (High School in year levels).

That's a pretty standard filter pattern and keeps the scope reasonable.

Let's go with this — seed-driven taxonomy, many-to-many resource tagging, validation in the service layer, read-only taxonomy API, and OR/AND filtering. 

