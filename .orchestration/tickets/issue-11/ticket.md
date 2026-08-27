# [MVP] Add resource download endpoint and download count tracking

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/11

## Problem
Teachers use Teacher Hub to share PDF classroom resources with other teachers. Today
the platform has no way for a user to actually download those PDFs, so even resources
that exist in the system cannot be consumed. In parallel, teachers who contribute
resources have no signal about which of their materials are useful, because nothing is
counting downloads.

Two product gaps flow from this: (1) resources are effectively "look but don't touch,"
which defeats the point of a sharing platform, and (2) contributors and (later)
platform operators have no visibility into resource usage, blocking downstream features
like teacher-profile stats (#13) and phase-2 monetisation (#15, #16).

## Impact
- Users affected: all MVP users (both consumers of resources and contributing teachers).
- Severity: **high** — resources are unusable end-to-end without a download path; this
  blocks the core "share and discover" MVP loop and is a prerequisite for #13.
- Frequency: **always** — every meaningful resource interaction ends in a download
  attempt.

## Success criteria
- A signed-in teacher viewing a resource can trigger a download and receive the correct
  PDF file in their browser.
- The system records a persistent, per-resource download count that increases by
  exactly one for each successful delivery of the file.
- The current download count is visible to users wherever resources are surfaced
  (resource card, resource detail view).
- Unauthenticated users cannot download resources.
- Each download is auditable: the system records who downloaded which resource and
  when.

## Acceptance criteria
- [ ] An authenticated user requesting a valid resource receives HTTP 200 with the PDF
      bytes, `Content-Type: application/pdf`, and
      `Content-Disposition: attachment; filename="<resource-name>.pdf"` where the
      filename reflects the resource's user-facing name.
- [ ] An unauthenticated request to the download endpoint returns HTTP 401 with a JSON
      error body and does not deliver any file bytes.
- [ ] A request for a non-existent resource returns HTTP 404 with a JSON error body.
- [ ] A request for a resource whose metadata exists but whose file is missing from
      storage returns HTTP 5xx with a JSON error body and does **not** increment the
      counter.
- [ ] On every successful (200) file delivery, the resource's download counter is
      incremented by exactly one and the increment persists across process restarts.
- [ ] Failed downloads (4xx, 5xx, aborted before delivery) do not increment the
      counter.
- [ ] Two concurrent successful downloads of the same resource result in the counter
      increasing by two (no lost updates).
- [ ] Each successful download creates an audit record capturing at minimum: resource
      identifier, downloading user identifier, and a timestamp.
- [ ] The resource detail view displays the current total download count for that
      resource.
- [ ] The resource card (list/grid view) displays the current total download count for
      that resource.
- [ ] A resource owner can retrieve download metrics for resources they own (count, and
      enough detail to power the profile totals in #13).
- [ ] An admin flow can retrieve download metrics across resources.
- [ ] The download URL does not expose internal storage paths (e.g. absolute file
      paths, raw bucket keys) to the client.

## Edge cases & non-functional
- **Concurrency:** counter increments under concurrent successful downloads must not
  be lost (see AC above).
- **Streaming:** PDF payloads may be multi-MB; the file should be streamed to the
  client rather than fully buffered in memory, so a large resource does not blow
  memory or hold the event loop.
- **Partial / aborted downloads:** if a client disconnects mid-transfer, the counter
  behaviour must be well-defined and consistent with the "successful delivery only"
  rule. See ambiguity below on exactly when "success" is committed.
- **Filename safety:** the resource name is teacher-supplied; the `Content-Disposition`
  filename must be sanitised so it cannot inject header content or produce a
  browser-unfriendly filename.
- **Error bodies:** 401 / 404 / 5xx responses return JSON, not HTML, so the client and
  future rate-limit/quota flows (#16) can react to them uniformly.
- **Backwards compatibility:** none required — this is net-new functionality on a
  greenfield MVP.
- **Security:** authorisation is required; whether *any* authenticated user can
  download *any* resource, or whether visibility rules apply, is called out as an
  ambiguity below.

## Out of scope
- Rate limiting and per-user download quotas — deferred to phase 2 (#16).
- Premium-membership download tiers — deferred to phase 2 (#15).
- Formats other than PDF — deferred to phase 2 (#18).
- Full analytics dashboards over download data — only the count display (card + detail)
  and basic owner/admin metric queries are in scope; richer dashboards are not.
- The teacher-profile totals surface that consumes these counts — tracked in #13.
- Any new authentication implementation — this feature consumes the auth story owned
  by #2 / #14; it must not re-solve auth.

## References
- Original issue: https://github.com/CarlosCunha99/teacher-hub/issues/11
- #4 — PDF resource upload and sharing workflow (produces the files this endpoint
  serves).
- #2 — Social authentication and session management (still OPEN; owns auth primitives).
- #14 — Support social login providers, Google and Microsoft (CLOSED; landed social
  login work — but see ambiguity: no auth code is visible in the current scoped view).
- #3 — PostgreSQL schema for users, resources, tags, boards, interactions (owns the
  resource / user tables this feature will read and write).
- #13 — Surface total likes and total downloads on teacher profile (consumer of the
  metrics this ticket produces).
- #16 — Phase 2, monthly free-tier download limits (future consumer of this endpoint).
- README.md — documents the current foundation-stage Next.js scaffold (App Router,
  Vitest, no DB or storage yet).

## Raw context used
- `raw-context.md` in this ticket workspace is empty (only the intake template). No
  additional Slack, docs, or customer notes were provided.
- Product context inferred from: the linked GitHub issue body, sibling MVP issues
  #2/#3/#4/#13, phase-2 issues #15/#16/#18, and `README.md` (foundation-stage scaffold
  with only a `/api/health` route).

## Enrichment notes
- **Inferred (repo state):** The codebase is at foundation stage. The only API route
  is `src/app/api/health/route.ts`, `src/lib/` contains only `health.ts`, and
  `package.json` has no database, storage, or auth dependencies. Downstream stages
  will therefore need to introduce resource metadata storage, file storage, and an
  auth check — but *how* is a solutioning concern, deliberately not answered here.
- **Inferred (auth availability):** Issue #14 (social login) is CLOSED, but no auth
  module is visible in the scoped read-list for this stage. The ticket assumes the
  download endpoint must gate on an authenticated session; whether that session
  mechanism already exists in-repo is a solution-level question for the planner.
- **Ambiguity:** "Metrics can be queried by resource owner and admin flows" — is
  scope in this ticket a **UI surface**, an **API**, or just an internal query
  capability that #13 and future admin work consume? Proposed reading: an internal
  query capability plus the two user-visible surfaces already listed (card + detail);
  no new admin UI in this ticket. Alternatives rejected: building an admin dashboard
  here (belongs to a future admin ticket). Blocking: **no** — planner may pick, but
  should be explicit.
- **Ambiguity:** Access control granularity — can *any* authenticated user download
  *any* resource, or are there visibility rules (e.g. resource owner + shared-with
  set, public/private flag)? Proposed reading: all authenticated users can download
  all resources for MVP (consistent with the "share and discover" framing and with
  #4's public sharing workflow). Alternatives rejected: per-resource ACLs (not
  mentioned anywhere in #4 or #11). Blocking: **no**, but if wrong it changes several
  ACs (401 vs 403 behaviour, audit fields).
- **Ambiguity:** Definition of "successful delivery" for counter increment — increment
  when headers + first byte are sent, or only after the full body has been streamed
  and the client has ack'd? Proposed reading: increment when the server has committed
  to a 200 response and finished writing the body without error (i.e. no counter for
  client aborts mid-stream). Alternatives rejected: increment on request accept (over-
  counts failed transfers). Blocking: **no**, but the planner must pick and document.
- **Ambiguity:** Where the PDF bytes live (local disk, S3, R2, other). No storage
  choice exists in-repo yet. Proposed reading: MVP-appropriate default chosen by the
  planner (local filesystem is consistent with foundation stage); the ticket only
  requires that internal paths not leak to the client. Blocking: **no**.
- **Ambiguity:** Where the download counter and audit records persist. No DB exists
  yet and #3 is still open. Proposed reading: whatever persistence layer the planner
  introduces or stubs must satisfy the "persists across sessions" and "no lost
  updates under concurrency" ACs. Blocking: **no** at the product level; may become
  blocking at plan time.

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
