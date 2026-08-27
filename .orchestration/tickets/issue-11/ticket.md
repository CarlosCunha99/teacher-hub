# [MVP] Add resource download endpoint and download count tracking

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/11

## Problem
Teachers share PDF resources on Teacher Hub, but there is currently no way for users to
download those resources, and no mechanism to track how many times a resource has been
downloaded. Without a download endpoint, resources are not useful even when viewable.
Without download tracking, teachers have no visibility into the impact of what they share.

## Impact
- Users affected: all teachers and anyone viewing resources (all MVP users)
- Severity: high — resources cannot be consumed without a download mechanism
- Frequency: always — applies to every resource interaction

## Success criteria
- A teacher can click "Download" on a resource detail page and receive the PDF file with correct headers.
- Each successful download increments a persistent download counter on the resource.
- The download count is visible on the resource detail view (and resource cards).
- Download is gated behind authentication — unauthenticated users cannot download.
- Logs record who downloaded what and when.

## Acceptance criteria
- [ ] Authenticated teachers can download PDF resources they can see.
- [ ] Download endpoint logs each download with user and timestamp.
- [ ] Resource detail page displays total download count.
- [ ] Download counts are accurate and persist across sessions.
- [ ] Download is only allowed for authenticated users.
- [ ] The file name and content-type headers are set correctly for browser downloads (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="<resource-name>.pdf"`).
- [ ] Resource files are downloadable through a secure endpoint.
- [ ] Each successful download increments a persistent counter.
- [ ] Download count appears on resource card and detail view.
- [ ] Download counting avoids duplicate increments from failed requests.
- [ ] Download metrics can be queried by resource owner and admin flows.

## Edge cases & non-functional
- Counter increments only on successful (200) file delivery, not on auth failures or missing files.
- Concurrent download requests should not result in lost increments (atomic counter updates).
- Resource not found → 404 with JSON error body.
- Unauthenticated request → 401 with JSON error body.
- File missing from storage (record exists but file gone) → 500 with JSON error body; do not increment counter.
- Large PDF files should be streamed, not buffered entirely in memory.
- The download URL should not expose internal storage paths directly.

## Out of scope
- Rate limiting / download quotas (see issue #16 — phase 2).
- Premium membership download limits (see issue #15 — phase 2).
- Support for file formats other than PDF (see issue #18 — phase 2).
- Download analytics dashboards (basic count display is in scope; full analytics are not).

## References
- https://github.com/CarlosCunha99/teacher-hub/issues/11
- Related: issue #4 (PDF resource upload and sharing workflow — source of resource files)
- Related: issue #2 (social auth and session management — source of authentication)
- Related: issue #13 (surface likes/downloads on teacher profile — consumes download counts)
- Related: issue #16 (phase 2: monthly free-tier download limits)

## Raw context used
- None provided beyond the issue body.

## Enrichment notes
- ⚠️ **Inferred**: No database or storage layer is implemented yet (project is at foundation stage). Implementation will need to establish patterns for resource metadata storage and file storage. This is a blocker-adjacent concern; the plan must address storage scaffolding.
- ⚠️ **Inferred**: Authentication is not yet implemented (issue #2 open). The download endpoint must include auth checks but may rely on a session/middleware stub that will be replaced when #2 lands.
- **Ambiguity:** Where are resource files stored (local disk, S3, Cloudflare R2)? Proposed: local filesystem for MVP (consistent with the scaffold stage); blocking: no (planner can pick MVP-appropriate default).
- **Ambiguity:** Is there an existing resource record/model? Proposed: no — the plan must introduce a minimal resource type; blocking: no.

---
## Original

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
