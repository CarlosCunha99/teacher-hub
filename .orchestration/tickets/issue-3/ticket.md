# [MVP] Design PostgreSQL schema for users, resources, tags, boards, and interactions

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/3
**Labels:** enhancement, mvp

## Problem

⚠️ **Inferred** (derived from issue #3 body plus the MVP issue set #4–#13; no data-model
artefacts exist in the repo yet — `find . -name "*.prisma"` returns nothing and there is no
`prisma/`, `db/`, or `migrations/` directory).

Teacher Hub currently has no persistence layer at all. The repository contains only the
Next.js application skeleton delivered by issue #1 (`src/app/`, `src/lib/health.ts`, a
deliberately database-free `/api/health` route). `.env.example` documents `DATABASE_URL`
only as a commented-out placeholder annotated "added in issue #3".

Because there is no shared data model, every downstream MVP capability is blocked: teachers
cannot have accounts that persist (#2), cannot publish resources (#4), cannot have those
resources tagged by subject and year level (#5), cannot search or filter them (#6), cannot
save/like them into boards (#7), and cannot have a profile that shows their contributions
(#8). Each of those issues would otherwise invent its own incompatible storage shape,
producing inconsistent, unsearchable data that has to be re-migrated later.

The people affected are the platform's teachers (indirectly — they see none of these
features until this lands) and the development team (directly — they are blocked or forced
into rework).

## Impact

✅ **Verified** — dependency direction confirmed by reading issues #4, #5, #6, #7, #8, #11,
#12, #13, all of which are OPEN and all of which assert persistence requirements.

- **Users affected:** all platform users indirectly (no teacher-facing feature can ship
  without it); the whole delivery team directly. Pre-launch MVP, so the current live user
  count is effectively zero.
- **Severity:** blocker — this is the critical-path foundation for at least 8 open MVP
  issues (#4, #5, #6, #7, #8, #11, #12, #13).
- **Frequency:** always — every request that is not `/api/health` will depend on this model.

## Success criteria

⚠️ **Inferred** — restated at product level from issue #3's own acceptance criteria and the
data needs asserted by downstream issues. No pre-existing product spec or design doc was
found in the repo (no `.github/` directory, no `docs/`, no `AGENTS.md`, no `CONTRIBUTING.md`;
`README.md` describes tooling only).

- A developer can start from a clean machine, run the documented setup steps, and end with a
  running local database that matches the agreed model — no manual SQL.
- Every entity and relationship required by MVP issues #4–#8 can be expressed and queried
  without a further schema redesign.
- Invalid data (an orphaned resource, a duplicate like, a tag outside the approved taxonomy)
  cannot be stored, even if application code is buggy.
- The discovery queries that issue #6 describes (keyword search over title/description,
  filter by subject + year level, sort by newest and by most liked/saved, paginated) return
  correct results and remain responsive on a seeded dataset representative of MVP scale.
- A reviewer of a future PR (#4–#13) can read one document and know how that feature is
  expected to read from and write to the database.

## Acceptance criteria

Confidence per group is marked inline. Criteria marked ❓ depend on an unresolved ambiguity
below and MUST NOT be treated as settled until the human gate answers it.

**Entities and relationships**

- [ ] ✅ The model stores teacher accounts, published resources, the subject taxonomy, the
      year-level taxonomy, personal boards, the resources placed in a board, and likes on
      resources. *(Source: issue #3 AC 1.)*
- [ ] ✅ A resource records at minimum its title, description, owning teacher, associated
      PDF file reference, and creation timestamp. *(Source: issue #4 AC "Uploaded PDF and
      metadata are persisted with owner and timestamp".)*
- [ ] ✅ A resource is attributable to exactly one owning teacher, and ownership is
      retrievable so that "teachers can edit or delete only resources they own" (#4) and
      "profile displays resources published by that teacher" (#8) are both answerable.
- [ ] ✅ A teacher can have many boards; a board belongs to exactly one teacher; a board can
      contain many resources; a resource can appear in many boards. *(Source: issue #7 AC
      "save a resource to one or more of their boards".)*
- [ ] ❓ A resource's association to subjects and to year levels is stored such that the
      cardinality agreed in **Ambiguity A2** holds and is enforced.
- [ ] ❓ "Saved" state is represented per the reading agreed in **Ambiguity A3**.
- [ ] ⚠️ A teacher record can carry the profile attributes issue #8 requires: display name,
      short bio, and a joined/registered date.
- [ ] ⚠️ A board carries a sharing/visibility attribute, so #8's "boards intended for
      sharing" can be distinguished from private ones.

**Integrity**

- [ ] ✅ A resource, board, board entry, or like cannot exist referencing a teacher or
      resource that does not exist. *(Source: issue #3 AC 2.)*
- [ ] ✅ A tag value that is not part of the approved subject/year-level reference data
      cannot be stored. *(Source: issue #5 AC "APIs reject tags that are not part of the
      approved taxonomy" — enforcement must not rely on application code alone.)*
- [ ] ⚠️ The same teacher cannot like the same resource twice, and the same resource cannot
      be added to the same board twice — the second attempt is rejected or is a no-op, not a
      duplicate row. *(Derived from #7's like/unlike and save/remove semantics; "like count"
      is only meaningful if likes are unique per teacher per resource.)*
- [ ] ⚠️ Deleting a resource or a teacher leaves no dangling likes or board entries, and the
      chosen deletion behaviour (cascade vs. block vs. soft-delete) is documented and
      consistent for every relationship.

**Query performance**

- [ ] ✅ Lookup paths used by the discovery feed and filters, feed ordering, and profile
      lookups are indexed. *(Source: issue #3 AC 3; concrete access patterns enumerated in
      #6 and #8.)*
- [ ] ⚠️ On a seeded dataset, listing the feed, filtering by subject + year level, keyword
      searching, and loading a teacher profile each complete without a full table scan over
      the resources table.
- [ ] ⚠️ Aggregate counts a teacher profile needs (resources published, boards, likes
      received) are obtainable in a way that stays acceptable as a teacher accumulates many
      resources. *(Source: issue #13 AC "Aggregations are performant for users with many
      resources" — #13 itself is a separate issue; only the model's ability to support this
      is in scope here.)*

**Developer workflow**

- [ ] ✅ Migrations can be applied to an empty database and rolled back cleanly, leaving no
      partial state. *(Source: issue #3 AC 4.)*
- [ ] ✅ A seed script populates a local/QA database with data rich enough to exercise the
      MVP scenarios: multiple teachers, resources across several subjects and year levels,
      boards with saved items, and likes. *(Source: issue #3 AC 5.)*
- [ ] ✅ Data access conventions for API routes are documented, so issues #4–#11 can follow
      one pattern rather than inventing their own. *(Source: issue #3 AC 6.)*
- [ ] ✅ `DATABASE_URL` (and any other new variable) is documented in `.env.example` with no
      real secret committed, matching the existing convention in that file and the README's
      "Environment configuration" section. *(Verified: `.env.example` already reserves a
      commented `DATABASE_URL` line for this issue.)*
- [ ] ⚠️ The existing `npm run lint`, `npm test`, and `npm run build` scripts still pass, and
      any new database step does not require a live database for a plain `npm test` run of
      pre-existing tests. *(Verified: `package.json` defines exactly these scripts; README
      states CI runs install → lint → test → build; `/api/health` is documented as
      intentionally database-free.)*

## Edge cases & non-functional

- ⚠️ **Deletion semantics.** #4 lets a teacher delete their own resource while #7 lets other
  teachers have that resource saved in their boards and liked. What a third party sees after
  a deletion must be defined (disappears silently vs. tombstone).
- ⚠️ **Concurrency.** Two simultaneous likes, or two simultaneous saves of the same resource
  to the same board, must not produce duplicates or a failed user action.
- ⚠️ **Counter accuracy.** #7 shows a like count and #11/#13 show download counts; whatever
  the model does must not drift from the underlying interaction records.
- ⚠️ **Taxonomy evolution.** #5 requires taxonomy to be "managed for MVP", and Phase 2 issue
  #17 will extend it to university level; retiring or renaming a subject must not orphan or
  silently retag existing resources.
- ❓ **Auth shape.** Issue #2 delivers *social* login (Google + Microsoft). A teacher may sign
  in with either provider, and #2 requires "returning users are mapped to their existing
  account correctly" — so identity and provider linkage must be representable. See
  **Ambiguity A1**.
- ⚠️ **Draft vs. published.** #4 says "newly published resources appear in the main discovery
  feed" and #6 lists "published resources", implying a publication state distinct from
  merely existing. No issue defines a draft flow, so at minimum publication state must be
  representable.
- ⚠️ **Timestamps & ordering.** #6 requires "newest" sorting and #7 requires board pages
  "sorted by most recent saves" — creation time must be captured on resources *and* on
  board entries, not only on resources.
- ⚠️ **Text search semantics.** #6's keyword search spans title and description; behaviour
  for case, accents, and partial words affects whether a tester's search returns a hit.
- ⚠️ **Portability.** README pins Node 20 and the app runs identically locally and in CI;
  the database setup must be reproducible in both without manual steps.
- ⚠️ **No secrets in git.** `.gitignore` and README establish that only `.env.example` is
  committed; connection strings must follow that.

## Out of scope

- Building any user-facing feature. This ticket delivers the data foundation only; upload
  (#4), tagging UI (#5), search UI (#6), boards UI (#7), and profiles (#8) remain their own
  issues.
- Authentication behaviour itself (sign-in, sign-out, session invalidation, protected route
  rejection) — that is issue #2.
- ⚠️ Download recording and counting (#11) and terms-of-use acceptance records (#12) — see
  **Ambiguity A4**; the current proposal is that each issue adds its own storage via its own
  migration.
- Profile aggregate metrics display (#13).
- All Phase 2 concerns: premium membership (#15), monthly free-tier download limits (#16),
  university-level taxonomy (#17), and non-PDF upload formats (#18). The model should not be
  designed *against* these, but nothing is delivered for them here.
- Production database provisioning, hosting, backups, and operational runbooks — not
  mentioned in any issue and no infrastructure config exists in the repo.

## References

- Original ticket: https://github.com/CarlosCunha99/teacher-hub/issues/3
- Depends on / interacts with: #2 (social auth, **still OPEN**)
- Consumers of this model: #4, #5, #6, #7, #8, #11, #12, #13
- Completed foundation: #1 (merged as PR #9, commit `d33df6d`)
- Phase 2 (must not be blocked, not delivered here): #15, #16, #17, #18
- Closed as completed with no code in this repo: #10, #14 — treated as superseded by #4 and
  #2 respectively.
- Repo conventions: `README.md` (tech stack, scripts, folder structure, environment
  configuration), `.env.example`, `package.json`. No `.github/`, `AGENTS.md`, or
  `CONTRIBUTING.md` exists.

## Raw context used

- `.orchestration/tickets/issue-3/raw-context.md` — **none provided**; the file contains only
  its unmodified template placeholder text. All context below was gathered by the enricher
  from the repository and the GitHub issue tracker.

## Enrichment notes

- The raw ticket carried an "Implementation Notes" section naming Prisma, `schema.prisma`,
  `prisma migrate`, and `prisma/seed.ts`. Those are solution-level and have been removed from
  the body of this product ticket; they are preserved verbatim under `## Original` for the
  solution stage to consider. No tool choice is asserted or endorsed here.
- The raw ticket's Context section stated "Issue #1 is merged" — ✅ verified (PR #9, commit
  `d33df6d`). It also stated issue #2 "will establish the user account model before this
  ships" — ❓ **not verified**: issue #2 is still OPEN with no branch or PR, so at the time of
  writing nothing defines a users table.

- **Ambiguity A1 — who owns the users table, and what shape is it?**
  The raw ticket asserts the users table will arrive from issue #2 as
  `id, email, password_hash, name, created_at`. This conflicts with issue #2's actual body,
  which is *social login only* (Google OAuth, Microsoft OAuth) and never mentions passwords;
  a `password_hash` column would be dead weight and a security liability. Issue #2 is also
  still OPEN, so this ticket cannot depend on it having landed. Issue #3's own AC 1 explicitly
  lists "users" among the tables this ticket must deliver.
  *Proposed reading:* this ticket owns and defines the teacher/user entity, with no password
  field, and with room for one or more linked external identity providers plus the profile
  fields #8 needs (name, bio, joined date). Issue #2 then builds session handling on top.
  *Alternatives rejected:* (a) wait for #2 — would block 8 issues on an unstarted one;
  (b) copy the stated `password_hash` shape — contradicts #2's social-only requirement.
  **blocking: yes** — it decides whether "the model stores teacher accounts" is even an
  acceptance criterion of this ticket, and whether a credential column exists.

- **Ambiguity A2 — how many subjects and year levels can a resource have?**
  Issue #4 says a teacher creates a resource with "subject, year level" (singular). Issue #5
  says creation requires "subject and year-level selections" (plural) and #3's AC talks about
  "tags". A tester writing "resource with two subjects is accepted/rejected" needs this
  settled.
  *Proposed reading:* many-to-many both ways — a resource may carry one or more subjects and
  one or more year levels — since a worksheet commonly spans e.g. Years 5–6, and the plural
  wording in #5 is the more specific statement about tagging.
  *Alternatives rejected:* single mandatory subject + single mandatory year level (simpler,
  but a later change to many-to-many is a breaking migration for every consumer).
  **blocking: yes** — it directly determines the assertion in an acceptance criterion.

- **Ambiguity A3 — is "saved" a separate thing from "in a board"?**
  Issue #3's AC lists "boards, board items, likes, and saved relationships" as if saves were
  distinct from board items, while issue #7 describes saving exclusively *into* a board
  ("save a resource to one or more of their boards") and #6 wants sorting by "most liked/
  saved".
  *Proposed reading:* a save **is** a board entry; there is no board-less save, and "saved
  state" on a resource card means "present in at least one of my boards".
  *Alternatives rejected:* a separate flat save/bookmark list alongside boards — no issue
  describes a UI for such a list, so it would be unused surface, but it is the literal
  reading of #3's wording.
  **blocking: yes** — it changes both the entity list and what "resource cards display saved
  state" (#7) asserts.

- **Ambiguity A4 — are download counts (#11) and terms acceptance (#12) in scope now?**
  Neither appears in issue #3's acceptance criteria, but both are storage concerns and #13
  needs download aggregates per teacher. Note also that Phase 2 issue #16 needs *per-user,
  per-month* download counts, which a single running total on a resource cannot satisfy.
  *Proposed reading:* out of scope here; #11 and #12 each add their own storage in their own
  migration. This ticket only commits to not making that impossible.
  *Alternatives rejected:* include them now for a single "complete" foundation — expands
  scope beyond the stated ACs and pre-judges #11's counting semantics.
  **blocking: no** — the proposed reading is the conservative one and matches #3's stated ACs.

- **Ambiguity A5 — board visibility.**
  Issue #8 requires a profile to display "the teacher's boards intended for sharing", which
  implies some boards are not. Issue #7 calls all boards "personal" and lists no visibility
  control.
  *Proposed reading:* the board entity carries a visibility/sharing attribute so #8 can
  filter on it; the UI to change it belongs to #7 or #8, not here.
  *Alternatives rejected:* all boards public (contradicts "personal" in #7); all boards
  private (makes #8's criterion unsatisfiable).
  **blocking: no** — grounded in explicit wording in #8.

## Needs clarification

The following sections rest on inferred (⚠️) or unverified (❓) material. The orchestrator
should put these to the user **before** the brainstorm stage.

| # | Area | Confidence | Question |
|---|------|-----------|----------|
| 1 | Problem, ACs → *Entities*, Edge cases → *Auth shape* | ❓ | **A1:** Does this ticket define the users/teachers table itself (no password field, social-identity linkage, plus name/bio/joined-date), or must it wait for issue #2? |
| 2 | ACs → *Entities* | ❓ | **A2:** Can a resource have multiple subjects and multiple year levels, or exactly one of each? |
| 3 | ACs → *Entities*, Out of scope | ❓ | **A3:** Is a "save" always a board entry, or is there also a board-less saved/bookmarked list? |
| 4 | Out of scope | ⚠️ | **A4:** Confirm download records (#11) and terms acceptance (#12) are deferred to their own issues rather than modelled now. |
| 5 | ACs → *Entities*, Edge cases | ⚠️ | **A5:** Confirm boards need a public/private (sharing) attribute now, so #8's profile can show only shared boards. |

Additionally unverified (❓) because no repo evidence exists and no issue states it:
expected MVP data volumes and the concrete latency target behind "performant" (#13) and
"find content in minutes" (#6). Absent an answer, the performance criteria above are stated
qualitatively rather than with invented numbers.

---
## Original

> Preserved verbatim from the raw ticket / GitHub issue #3 body. Retained for traceability;
> the "Implementation Notes" below are solution-level and are **not** endorsed by this
> product ticket.

```markdown
# [MVP] Design PostgreSQL schema for users, resources, tags, boards, and interactions

**Issue:** #3  
**Labels:** enhancement, mvp  
**Author:** CarlosCunha99 (Carlos Cunha)

## User Story

As a teacher, I want resources and collections to be stored in a consistent data model so that information is accurate, searchable, and scalable.

## Scope

Define MVP relational schema and migrations for core entities and relationships.

## Acceptance Criteria

- [ ] PostgreSQL schema includes tables for users, resources, subjects, year levels, boards, board items, likes, and saved relationships.
- [ ] Foreign keys and constraints enforce referential integrity.
- [ ] Indexes are added for frequent lookup patterns (search filters, feed ordering, user profile lookups).
- [ ] Initial migration(s) can be applied and rolled back successfully.
- [ ] Seed data script exists for local development and QA scenarios.
- [ ] Data access layer conventions are documented for API route usage.

## Context

- Issue #1 (Next.js foundation) is merged.
- Issue #2 (auth) will establish the user account model before this ships, so we can assume the users table structure from issue #2: `id, email, password_hash, name, created_at`.
- This is the database foundation for the entire platform.

## Implementation Notes

1. Use Prisma ORM + PostgreSQL for type-safe database access.
2. Create a Prisma schema file (`prisma/schema.prisma`) with all tables and relationships.
3. Create migrations using `prisma migrate` for local dev and CI.
4. Seed data with `prisma/seed.ts` for development fixtures.
5. Document how future issues #4-#11 will use the DAL (data access layer).
6. Write comprehensive tests to verify schema integrity and migrations.

Once complete, open a PR for review.
```
