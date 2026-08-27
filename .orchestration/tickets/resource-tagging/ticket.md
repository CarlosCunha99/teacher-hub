# [Phase 2] Add resource tagging and filtering by custom categories

**Type:** feature
**Source:** text-only (session description; closest related GH issues: #5 standard taxonomy, #3 schema)

## Problem

Teachers use Teacher Hub to share and discover classroom resources. The standard
subject/year-level taxonomy planned in issue #5 covers the most common filtering
needs, but teachers who work on niche interdisciplinary topics, follow a specific
institutional/exam-board curriculum, or teach highly specialised subjects cannot
adequately describe their resources with the fixed subject/year vocabulary alone.

As a result, valuable resources are either mis-tagged into the nearest standard
category (which hurts discovery quality for everyone) or effectively invisible to
the teachers who would benefit from them most.

Phase 2 introduces a *custom* tagging layer that lives **alongside** the standard
taxonomy. Teachers can define their own free-form tags (e.g. "STEM Challenge",
"AQA GCSE", "Block 3 Unit 2", "SEND-friendly") and attach them to resources they
own. Other teachers can then filter the resource catalogue by those custom tags,
optionally combined with the standard subject/year filters.

## Impact
- **Users affected:** all teachers who upload resources, plus all teachers browsing
  the catalogue. The uploader side is the driver; the browser side benefits from
  richer filtering.
- **Severity:** medium — standard taxonomy still works; this is a discovery uplift,
  not a broken-flow fix.
- **Frequency:** often — any teacher with institutional/exam-board or niche
  materials hits the limits of the standard taxonomy on their first upload.

## Success criteria
- A teacher can create, list, and remove their own custom tags without affecting
  any other teacher's tags.
- A teacher can attach one or more custom tags to a resource they own, and remove
  them again.
- Any teacher browsing the catalogue can filter resources by one or more custom
  tags, independently of, or combined with, the standard subject/year filters.
- Custom tags are private to the teacher who created them: no shared/global tag
  namespace is created, and one teacher's tag list is never polluted by another's.
- Custom tag data persists across requests/sessions (survives server restart).
- The behaviour is documented for API consumers in a way consistent with the rest
  of the Teacher Hub API surface.

## Acceptance criteria
- [ ] An authenticated teacher can create a custom tag by supplying a human-readable
      name; the system returns the stored tag including a URL-safe slug derived
      from the name.
- [ ] An authenticated teacher can list all custom tags they own; another teacher's
      tags never appear in that list.
- [ ] An authenticated teacher can delete a custom tag they own; after deletion the
      tag disappears from their tag list and from every resource it was attached to.
- [ ] An authenticated teacher can attach one of their own custom tags to a resource
      they own, and detach it again.
- [ ] A teacher cannot attach a tag they do not own, cannot attach any tag to a
      resource they do not own, and cannot delete or mutate another teacher's tag.
      All such attempts are rejected with an authorization error, not a silent no-op.
- [ ] Unauthenticated requests to any tag-management or tag-assignment endpoint are
      rejected with an authentication error.
- [ ] Any teacher (including unauthenticated browsers if browsing is public) can
      filter the resource listing by one or more custom tag slugs and receive only
      resources that carry those tags.
- [ ] The filter supports both "match any of these tags" (OR) and "match all of these
      tags" (AND) semantics; the default and the way to switch between them is
      documented and stable.
- [ ] Custom-tag filtering composes with existing/planned subject and year-level
      filters: applying both narrows the result set to resources that satisfy both.
- [ ] Tag slug generation is deterministic (lowercase, whitespace/punctuation
      collapsed to hyphens) and unique per-teacher: creating two tags with names
      that would collide is either rejected or disambiguated in a documented way.
- [ ] Tag names are trimmed of surrounding whitespace before storage; empty or
      whitespace-only names are rejected with a validation error.
- [ ] All new behaviour is covered by automated tests at the level already used
      elsewhere in the repo (Vitest), including at least one happy-path and the
      key authorization/validation error cases per endpoint.

## Edge cases & non-functional
- **Cross-teacher isolation:** two teachers may independently create tags with the
  same display name; each sees only their own.
- **Cascade on delete:** deleting a tag removes every resource↔tag association for
  that tag; the resources themselves are not deleted.
- **Cascade on resource delete:** deleting a resource removes its tag associations
  but does not delete the tag definitions.
- **Cardinality:** a resource may carry zero or more custom tags; no upper limit is
  enforced at MVP but the design should not preclude adding one later.
- **Filter with unknown slug:** filtering by a slug that does not exist (for any
  teacher) returns an empty result set, not an error.
- **Filter with mixed valid/invalid slugs:** ⚠️ Inferred — unknown slugs are treated
  as matching nothing, so they do not widen OR results and cause AND results to be
  empty. Confirm with product if a different behaviour is preferred.
- **Idempotency:** attaching a tag that is already attached to the resource is a
  no-op (not an error); detaching a tag that is not attached returns a not-found
  or no-op consistently.
- **Backward compatibility:** existing resource-listing consumers that do not pass
  a custom-tag filter see unchanged behaviour.
- **Security:** tag names are user-supplied free text and must be safely stored and
  returned (no injection, no XSS when eventually rendered).
- **Performance:** filtering by tag slugs must remain acceptable for a catalogue in
  the low tens of thousands of resources; exact indexing strategy is a downstream
  concern but the acceptance criteria assume it is possible.
- **Internationalisation:** tag names may contain non-ASCII characters (accents,
  non-Latin scripts). Slug generation must handle these without throwing; a
  documented normalisation (e.g. transliterate or preserve as URL-encoded) is
  acceptable as long as it is deterministic.

## Out of scope
- A global/shared tag taxonomy or teacher-to-teacher tag discovery.
- Tag renaming, merging, or bulk-editing UI.
- Full-text search over tag names, autocomplete/suggestions, or "popular tags".
- Analytics on tag usage.
- The Phase 2 university-level *standard* taxonomy extension (issue #17) — that is
  an expansion of the standard taxonomy, not the custom layer.
- Building the frontend UI for managing tags. This ticket delivers the API-level
  capability; UI wiring is tracked separately.

## References
- Issue #5: [MVP] Implement subject and year-level taxonomy tagging — the standard
  taxonomy this ticket sits alongside.
- Issue #3: [MVP] Design PostgreSQL schema for users, resources, tags, boards, and
  interactions — target persistence conventions.
- Issue #2: [MVP] Implement social authentication and session management — supplies
  the authenticated-teacher identity this ticket depends on.
- Issue #6: [MVP] Deliver search and browse experience for resource discovery —
  the browse experience custom-tag filtering will eventually plug into.
- Repo `README.md` — tech stack (Next.js 15 App Router, TypeScript strict, Vitest).

## Raw context used
- `.orchestration/tickets/resource-tagging/raw-context.md` is empty at time of
  enrichment; no additional unstructured context was supplied.
- Session description: "Allow teachers to create and use custom tags/categories
  for organizing resources beyond the standard subject/year taxonomy. This adds
  flexibility for niche topics and institutional needs."
- Repo inspection: `src/app/api/health/route.ts` is the only current route
  handler; there is no persistence layer, no auth layer, and no existing
  resource model in the codebase yet (MVP issues #1–#8 are still open).

## Enrichment notes

Confidence indicators used below: ✅ Verified against repo/issues, ⚠️ Inferred
from product context, ❓ Unverified.

- ✅ Verified: Standard subject/year-level taxonomy is planned but not yet built
  (issue #5 open, no code in `src/`). This ticket assumes it will exist at
  integration time but does not require it to exist at implementation time.
- ✅ Verified: There is no authentication layer, no persistent storage, and no
  resource entity in the repo yet.
- ⚠️ **Ambiguity — authenticated-teacher identity:** MVP auth (issue #2) is not
  yet implemented. The product intent ("teacher can create their own tags") is
  clear, but the mechanism by which a request is attributed to a specific teacher
  is undefined at ticket time. Proposed reading: this ticket is *about the
  product behaviour*, not the auth mechanism; a temporary identification approach
  (e.g. a request header interpreted as the teacher id) is acceptable for
  end-to-end functionality and testing, and the real auth wiring is a follow-up
  once #2 lands. **Blocking: no.**
- ⚠️ **Ambiguity — persistence target:** issue #3 targets PostgreSQL, but the
  repo has no database, ORM, or migration tooling yet. Proposed reading: any
  persistence choice that (a) survives process restart, (b) can be swapped for
  PostgreSQL later without changing the API contract, and (c) is consistent with
  the repo's existing tooling is acceptable. **Blocking: no.**
- ⚠️ **Ambiguity — default AND vs OR filter mode:** teachers filtering by
  multiple tags could reasonably want either "any of" (broad discovery) or "all
  of" (precise recall). Proposed reading: default to OR (broader discovery aligns
  with the "help me find niche resources" problem), with an explicit switch to
  AND. **Blocking: no** — either default is acceptable as long as it is
  documented and stable.
- ❓ Unverified: whether the browse/list endpoint is publicly reachable or
  requires authentication. Current success criteria describe both cases so the
  ticket is safe either way.
- Non-blocking: no upper cap on tags-per-resource or tags-per-teacher is set at
  MVP; the design should not make adding one later hard.

---
## Original
User request: "Allow teachers to create and use custom tags/categories for organizing resources beyond the standard subject/year taxonomy. This adds flexibility for niche topics and institutional needs."
