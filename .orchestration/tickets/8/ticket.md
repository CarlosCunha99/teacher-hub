# [MVP] Build teacher profile pages with contributions and collections

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/8

## Problem
Teachers on Teacher Hub publish resources and curate boards, but there is no place for a
peer to see everything a given teacher has contributed. A teacher who wants their work to
be discovered, trusted, and reused has no shareable identity on the platform, and a
teacher evaluating whether to reuse someone's material has no way to judge that person's
body of work at a glance.

This ticket introduces a **public teacher profile page** that gathers a teacher's
published resources and their shareable boards in one place, along with basic identity
(name, short bio, joined date) and accurate contribution counts. It also lets a teacher
edit their own profile details.

- Verified — the profile page as a first-class surface is called out across sibling MVP
  issues: profile lookups are an explicit index target in the schema issue
  (#3: "user profile lookups") and #13 layers profile-level metrics on top of it.

## Impact
- **Users affected:** All teachers (both as profile owners wanting visibility and as
  visitors evaluating peers). Inferred — no user/traffic data in repo; scope is the full
  teacher base per the MVP framing.
- **Severity:** high. Inferred — it is an MVP-labelled feature and a dependency surface
  for #13 (profile metrics), but it is not a login/data-integrity blocker.
- **Frequency:** often. Inferred — profile viewing is a core discovery/trust loop in a
  resource-sharing product; no analytics exist to confirm.

## Success criteria
- A visitor can open a teacher's public profile and, without signing in, see that
  teacher's name, short bio, joined date, published resources, and shareable boards.
- The profile shows counts of published resources and shareable boards that match what is
  actually displayed.
- Requesting a profile for a non-existent teacher yields a clear "not found" experience
  rather than an error or blank page.
- A signed-in teacher can update their own profile identity (at minimum name and short
  bio) and see the change reflected on their public profile.

## Acceptance criteria
- [ ] A teacher's public profile page displays their **name**, **short bio**, and
      **joined date**.
- [ ] The profile lists the **resources published by that teacher**.
- [ ] The profile lists the **teacher's boards that are intended for sharing** (see
      Ambiguity: board sharing model — blocking).
- [ ] The profile shows a **resource count** and a **board count** that accurately match
      the items displayed on the page.
- [ ] Requesting a profile for a **non-existent / unknown teacher** returns a proper
      **not-found state** (clear message, correct not-found semantics), not a server error
      or empty shell.
- [ ] A **signed-in teacher can edit their own profile information** (name, short bio)
      from account settings, and the update is reflected on their public profile.
- [ ] A teacher **cannot edit another teacher's** profile information.
      Inferred from the ownership pattern established in #4 ("edit or delete only
      resources they own") and #2 ("protected routes reject unauthenticated requests").

## Edge cases & non-functional
- **Empty states:** A teacher with zero published resources and/or zero shareable boards
  still has a valid profile; the page shows an appropriate empty state and counts of 0.
  Inferred — not stated in the ticket but implied by "counts shown accurately."
- **Visibility rules:** Only content a visitor is allowed to see should appear. Published
  resources are public; private/draft resources and non-shareable boards must be excluded
  from a public profile, and excluded from the displayed counts. Unverified — no
  resource/board visibility model exists in the repo yet (see Needs clarification).
- **Not-found vs. private:** Behaviour for a real-but-private/deactivated teacher account
  vs. a genuinely non-existent one. Unverified — account states are not defined in the
  repo.
- **Long/edge content:** Long names/bios, missing bio, special characters, and unicode
  should render without breaking layout. Inferred (standard a11y/i18n hygiene).
- **Performance:** Profile listing and counts should remain responsive for teachers with
  many resources/boards. Inferred; #3 explicitly indexes "user profile lookups," and #13
  flags aggregation performance for high-volume users.
- **Consistency after edits:** Editing profile identity should be reflected consistently
  on the public profile.

## Out of scope
- **Aggregate impact metrics** (total likes received, total downloads) on the profile —
  owned by **#13**. This ticket surfaces contributions and collections, not analytics.
- **Creating/managing boards, saving, and likes** — owned by **#7**.
- **Resource upload/publish workflow** — owned by **#4**.
- **Authentication / session management and social login** — owned by **#2 / #14**.
- **Data model / schema and migrations** for users, resources, boards — owned by **#3**.
- Following/messaging teachers, avatars/photo upload, profile URLs/handles/vanity slugs,
  and profile SEO — not requested for MVP. Inferred non-goals; flag separately if desired.

## References
- Original ticket: https://github.com/CarlosCunha99/teacher-hub/issues/8
- #3 — Design PostgreSQL schema for users, resources, tags, boards, and interactions
  (provides users/resources/boards tables and the profile-lookup index this page relies on)
- #7 — Add Pinterest-style saves, boards, and like interactions (defines "personal boards")
- #4 — Build PDF resource upload and sharing workflow (defines "published resources")
- #2 / #14 — Social authentication and session management (defines the signed-in teacher)
- #13 — Surface total likes and total downloads on teacher profile (builds on this page)
- README.md — repo is a Next.js App Router skeleton; profiles listed as a downstream MVP feature

## Raw context used
- None provided — `.orchestration/tickets/8/raw-context.md` contains only the empty intake
  template. All supporting context was gathered from the GitHub issue and sibling MVP
  issues (#2, #3, #4, #7, #13) via the `gh` CLI, and from the repo skeleton (README.md,
  `src/`).

## Enrichment notes
- **Repo maturity:** The repository is currently a foundational skeleton (only #1 is
  merged). There is **no** user, resource, or board data model, no auth, and no profile
  code yet (`src/app/` contains only `layout.tsx`, `page.tsx`, and a health API). This
  ticket therefore depends on #2, #3, #4, and #7 landing (or being coordinated) first.
  This is flagged for the human at the gate, not resolved here.
- **Bio & joined date fields:** The ticket asks for "short bio" and "joined date." #3's
  schema ACs list a users table but do not explicitly enumerate a `bio` column. Treating
  bio as a required profile field is an interpretive leap.
  - **Ambiguity:** Proposed reading — the users table exposes (or will expose) `name`,
    `bio`, and a creation/joined timestamp. Alternative rejected — bio lives in a separate
    profile table; immaterial at product level. blocking: no
- **Board sharing model:** The ticket says the profile shows "boards intended for sharing"
  and mentions "collection visibility controls," but #7 defines boards only as **personal**
  collections with no public/shared visibility concept. Whether a board can be marked
  shareable — and what the default is — directly determines what the "boards" acceptance
  criterion asserts.
  - **Ambiguity:** Proposed reading — a board has a visibility attribute (e.g.
    public/shareable vs. private), and the profile lists only boards the owner has marked
    shareable; private boards are hidden and excluded from the board count. Alternatives:
    (a) all of a teacher's boards are public and shown; (b) no per-board visibility exists
    for MVP and every board appears. These produce materially different acceptance
    criteria and test cases. blocking: **yes**
- **Profile visibility default:** The ticket says "public profile pages," so profiles are
  assumed viewable without authentication. Inferred; consistent with a discovery-oriented
  platform. blocking: no

## Clarifications (resolved)

The enricher flagged 5 product questions; all resolved via autopilot decision-making using
reasonable MVP defaults aligned to the ticket language and MVP patterns:

1. ✅ **Board sharing model** — Resolved: MVP boards have a per-board `shareable` flag
   (yes/no). The profile lists only boards marked shareable; private boards are excluded
   from display and counts. This aligns with "boards intended for sharing" language.
2. ✅ **Resource visibility** — Resolved: Only published resources appear (drafts/private
   excluded); they are excluded from display and counts. Standard visibility hygiene.
3. ✅ **Not-found vs. private** — Resolved: Non-existent teachers render as 404 "not found."
   Private/deactivated accounts are treated separately (out of scope for MVP; #2 handles auth).
4. ✅ **Editable profile fields** — Resolved: MVP lets teachers edit `name` and `bio`;
   `joined_date` is system-managed and read-only. Standard identity fields.
5. ✅ **Bio field** — Resolved: Assumed the users schema (#3) includes a `bio` column
   (standard profile field; if not, #3's AC must be updated to include it).

---
## Original
```
# [MVP] Build teacher profile pages with contributions and collections

**Issue:** https://github.com/CarlosCunha99/teacher-hub/issues/8
**Type:** enhancement
**Labels:** enhancement, mvp

## User Story

As a teacher, I want a profile page that shows my shared resources and curated boards so that peers can evaluate and reuse my contributions.

## Scope

Create public profile pages for teachers with contribution and collection visibility controls appropriate for MVP.

## Acceptance Criteria

- [ ] Each teacher has a profile page with name, short bio, and joined date.
- [ ] Profile displays resources published by that teacher.
- [ ] Profile displays the teacher's boards intended for sharing.
- [ ] Resource and board counts are shown accurately.
- [ ] Profile route handles missing users with a proper not-found state.
- [ ] Teachers can edit their own profile information from account settings.
```
