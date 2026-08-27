# [MVP] Surface total likes and total downloads on teacher profile

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/11

## Problem

Teachers on the platform currently have no way to see the aggregate impact of the resources they've shared. A teacher's profile page should surface community engagement metrics — specifically how many times their published resources have been liked and downloaded in total — so they can understand the usefulness of their contributions at a glance.

The platform needs both the data layer (tracking download events and counting likes) and the presentation layer (a stats section on the teacher profile header card) to fulfill this feature.

## Impact

- Users affected: All teachers with a published profile (all future registered teachers in MVP)
- Severity: medium
- Frequency: always (the stats are displayed on every profile page visit)

## Success criteria

- Teacher profile page shows "Total Likes" and "Total Downloads" prominently in a header card.
- The counts accurately aggregate only interactions on **published** resources (status = published), excluding drafts and deleted resources.
- Counts reflect the latest state without requiring a manual page refresh (real-time or near-real-time).
- A resource download event is recorded once per successful download request (no duplicate counting from failed requests).

## Acceptance criteria

- [ ] Teacher profile page displays the total likes across all their published resources.
- [ ] Teacher profile page displays the total downloads across all their published resources.
- [ ] Counts update in real-time (or near-real-time via revalidation) when resources are liked or downloaded.
- [ ] Counts are accurately aggregated from the database and only include published resources.
- [ ] The stats are prominently displayed on the profile (e.g., in a header card/stats bar).
- [ ] Stats only count interactions on published resources — drafts and deleted resources are excluded.
- [ ] Resource files are downloadable through a secure API endpoint.
- [ ] Each successful download increments a persistent counter (no double-counting on failed requests).
- [ ] Download count appears on resource card and detail view.
- [ ] Download metrics can be queried by resource owner.

## Edge cases & non-functional

- **Concurrent downloads**: increment must be atomic (race-condition safe at DB level).
- **Failed / aborted downloads**: count only increments after the file has been served successfully (not on request receipt).
- **Draft / deleted resources**: aggregate stats MUST exclude resources with status ≠ `published`.
- **Empty state**: teacher with zero published resources should display "0 likes" and "0 downloads" gracefully.
- **Performance**: aggregate queries should be efficient (indexed counts, not full table scans on every profile load).
- **Security**: download endpoint must validate that the resource is accessible (published) before serving the file and before incrementing the counter.

## Out of scope

- Notifications to teachers when their resources are liked/downloaded (separate feature).
- Per-resource breakdown of likes/downloads on the profile page (only aggregate totals for MVP).
- Admin analytics dashboard (noted in original issue as a future concern).
- Authentication/authorization implementation (assumed to be handled separately; this feature marks resources as requiring auth where appropriate but does not build the auth system).

## References

- GitHub issue #11: https://github.com/CarlosCunha99/teacher-hub/issues/11
- Labels: enhancement, mvp, frontend, backend, analytics

## Raw context used

- GitHub issue #11 body (original user story about download endpoint + tracking)
- User-supplied acceptance criteria in session prompt (extending to teacher profile display of aggregated stats)

## Enrichment notes

- The original issue #11 is titled "Add resource download endpoint and download count tracking" and focuses on the download side. The session prompt extends this to also surface **total likes** alongside total downloads on the teacher profile.
- The platform is in its earliest MVP stage (Next.js skeleton only — no database, no data models, no auth). This feature will require establishing the data layer (ORM + schema) as well as the API and UI layers.
- **Ambiguity:** No existing database or ORM is present in the repo. The implementation must choose one. Prisma + PostgreSQL is a standard Next.js choice; for MVP a SQLite-backed Prisma setup is simpler for local dev. blocking: no (proceeding with Prisma + SQLite for MVP, upgradeable to Postgres)
- **Ambiguity:** "Real-time" in acceptance criteria — for an MVP Next.js app with no WebSocket layer, this likely means server-side revalidation (Next.js `revalidatePath`) after mutations, not WebSockets. blocking: no (proceeding with Next.js revalidation approach)
- **Ambiguity:** Auth — the issue mentions "secure endpoint" but no auth system exists. For MVP the download endpoint will be publicly accessible for published resources; auth guard is out of scope. blocking: no

---
## Original

### GitHub Issue #11

**Title:** [MVP] Add resource download endpoint and download count tracking

**Body:**
## User Story
As a teacher, I want to download shared resources and see their usage, so that I can access materials and understand what is most useful.

## Acceptance Criteria
- [ ] Resource files are downloadable through a secure endpoint.
- [ ] Each successful download increments a persistent counter.
- [ ] Download count appears on resource card and detail view.
- [ ] Download counting avoids duplicate increments from failed requests.
- [ ] Download metrics can be queried by resource owner and admin flows.
