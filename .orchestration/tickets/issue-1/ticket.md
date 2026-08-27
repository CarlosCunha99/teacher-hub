# [MVP] Initialize Next.js project foundation and developer workflow

**Type:** feature (chore-flavored: project scaffolding / enabling work)
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/1

## Problem
Teacher Hub is a greenfield product with no application code yet — the repository
currently contains only orchestration metadata (no `package.json`, no source, no
README content). Before any teacher-facing feature (authentication #2, data model #3,
uploads #4, taxonomy #5, search #6, saves/boards #7, profiles #8) can be built, the
team needs an agreed, working application skeleton and a repeatable developer workflow.

Without this foundation, every subsequent issue would independently reinvent folder
structure, environment-config conventions, and lint/format/build tooling — leading to
inconsistency, rework, and integration friction across the MVP. This ticket exists so
that all downstream MVP work starts from one stable, conventions-driven baseline.

*Confidence: ✅ Verified — repo state confirmed empty via `git ls-files` (only
`.orchestration/*` tracked; `README.md`/`.gitignore`/`package.json` absent or empty).
Downstream dependency confirmed via `gh issue view 2`, `gh issue view 3`.*

## Impact
- Users affected: The engineering team building the MVP (internal). No direct
  end-user teacher impact yet; indirect — this unblocks all teacher-facing features.
- Severity: blocker — issues #2–#8 cannot begin without it.
- Frequency: always — every downstream issue depends on these conventions.

*Confidence: ✅ Verified — foundation dependency stated in ticket Background and
consistent with issues #2–#8 all being "[MVP]" enhancements filed after #1.*

## Success criteria
- A developer can clone the repo, install dependencies, and start the app locally
  with documented commands, with no undocumented manual steps.
- The running app exposes a health-check endpoint that returns a successful response.
- A developer can run lint, format, and build/test commands successfully from
  `package.json` scripts.
- A new contributor can understand the folder layout and where UI, API routes, and
  shared utilities belong from the README, without asking the author.
- The same scripts used locally can be run unmodified in CI (install → lint →
  test/build).

*Confidence: ✅ Verified against the six acceptance criteria in the source issue.*

## Acceptance criteria
- [ ] A Next.js application is scaffolded with a clear, documented folder structure
      that separates UI components, API routes, and shared utilities.
- [ ] An environment-variable strategy exists and is documented (e.g. an
      `.env.example` or equivalent) and supports local development; secrets are not
      committed (a `.gitignore` excludes local env files).
- [ ] A health-check API route exists and returns a successful HTTP 2xx response with
      a machine-readable body (e.g. a status indicator) when the app is running.
- [ ] Linting and formatting scripts are configured in `package.json` and run
      successfully against the scaffolded codebase (exit 0 on a clean tree).
- [ ] The README documents startup instructions (install + run) and high-level
      architecture notes (folder layout, tech stack, env config).
- [ ] `package.json` provides CI-ready scripts for install, lint, and test/build such
      that each completes successfully in a fresh checkout.

*Confidence: ✅ Verified — carried over from the source issue and made testable
(added explicit "runs successfully / returns 2xx / exit 0" assertions so a tester can
turn each into a concrete check). ⚠️ Inferred additions: the `.env.example` and
`.gitignore` details are inferred conventions, not spelled out in the source issue —
see Needs clarification.*

## Edge cases & non-functional
- Local env files (`.env*.local`) and build artifacts / `node_modules` must be
  git-ignored so secrets and generated files are never committed. *(⚠️ Inferred
  convention.)*
- Health-check route should respond even before a database is provisioned (foundation
  ships before the PostgreSQL schema in #3), so it must not hard-depend on a live DB
  connection to return healthy. *(⚠️ Inferred from sequencing: #3 delivers the DB.)*
- Lint/format/build scripts should be deterministic and non-interactive so they can
  run unattended in CI. *(✅ Verified — implied by the "CI-ready scripts" criterion.)*
- Node.js runtime version should be pinned or documented so local and CI environments
  match. *(⚠️ Inferred — no version specified in source; needs confirmation.)*
- Accessibility / i18n / performance / security hardening of features are NOT in scope
  here (foundation only) — see Out of scope.

## Out of scope
- Authentication and session management — tracked in issue #2.
- PostgreSQL schema, migrations, seed data, and the data-access layer — tracked in
  issue #3. This ticket only establishes the *env-config approach* for connecting to a
  database later, not an actual DB connection or schema.
- Any teacher-facing feature UI (uploads, search, boards, profiles) — issues #4–#8.
- Production deployment / hosting / infrastructure configuration.
- CI pipeline definition itself (the workflow YAML) — this ticket only guarantees the
  *scripts* are CI-ready; wiring up a CI provider is not required unless clarified.

*Confidence: ⚠️ Inferred — scope boundaries derived from the content of issues #2–#8;
the source issue does not explicitly enumerate non-goals.*

## References
- Original ticket: https://github.com/CarlosCunha99/teacher-hub/issues/1
- Related / dependent issues:
  - #2 Teacher authentication and session management
  - #3 PostgreSQL schema for users, resources, tags, boards, interactions
  - #4 Resource upload and sharing workflow
  - #5 Subject and year-level taxonomy tagging
  - #6 Search and browse experience
  - #7 Pinterest-style saves, boards, and like interactions
  - #8 Teacher profile pages
- Docs: none present in repo (README empty at time of enrichment).

## Raw context used
- `raw-context.md` contained only the intake template with no substantive entries —
  "None provided" beyond the template.
- Primary evidence came from the GitHub issue body, repo state inspection
  (`git ls-files`), and downstream issues #2 and #3 (viewed via `gh`).

## Enrichment notes
- The repo is genuinely empty of application code; treated this as pure greenfield
  scaffolding. No existing conventions to honor, so several "conventions" below are
  proposals for the human/planner to confirm, not established facts.
- **Ambiguity:** Language choice — TypeScript vs JavaScript is not specified. Proposed
  reading: TypeScript (modern Next.js default; benefits the multi-issue MVP). Rejected
  alternative: plain JavaScript. This affects lint/format tooling and how a tester
  writes checks, but not *what* the acceptance criteria assert. blocking: no
- **Ambiguity:** Next.js router paradigm — App Router vs Pages Router is not specified.
  Proposed reading: App Router (current Next.js default) for API route + folder
  conventions. Rejected alternative: Pages Router. This is largely solution-level;
  surfaced for planner awareness. blocking: no
- **Ambiguity:** The "test/build" script — is a real test framework with at least one
  passing example test required, or is a build-only script (with a test placeholder)
  acceptable for this foundation? Proposed reading: include at least one trivial
  passing test so the CI "test" step is meaningful and non-empty. Rejected alternative:
  no test framework yet. This determines whether a tester can assert a passing test
  exists. blocking: no (proceed with proposed reading unless the author objects)
- **Ambiguity:** Package manager (npm / pnpm / yarn) is unspecified. Proposed reading:
  npm (lowest-friction default). blocking: no

## Needs clarification
The following sections rely on inferred conventions rather than repo evidence and
should be confirmed by the author before planning:
1. ⚠️ **Language:** TypeScript or JavaScript? (affects tooling + tests)
2. ⚠️ **Next.js router:** App Router or Pages Router? (affects folder + API conventions)
3. ⚠️ **Test expectation:** Does the "test/build" CI script need a real passing example
   test, or is build-only acceptable for now?
4. ⚠️ **Package manager & Node version:** npm assumed; any pinned Node version required?
5. ⚠️ **CI provider:** Is wiring an actual CI pipeline (e.g. GitHub Actions workflow)
   expected in this ticket, or only "CI-ready scripts"? (currently treated as out of
   scope)

**Recommendation to orchestrator:** These are all non-blocking with reasonable
defaults, so the pipeline can proceed to brainstorm using the proposed readings.
However, confirming #1 (language) and #3 (test expectation) with the user is advised,
as they most directly shape what testers assert. No ambiguity is `blocking: yes`;
overall confidence is medium-high.

---
## Original
```
# [MVP] Initialize Next.js project foundation and developer workflow

**Issue:** #1 (GitHub: CarlosCunha99/teacher-hub)
**Author:** Carlos Cunha
**Labels:** enhancement, mvp

## User Story
As a teacher using Teacher Hub, I want a stable and well-structured application foundation so that core features can be developed and delivered reliably.

## Scope
Set up baseline Next.js app structure, API route conventions, environment config approach, and shared engineering standards for MVP delivery.

## Acceptance Criteria
- [ ] Next.js app is scaffolded with a clear folder structure for UI, API routes, and shared utilities.
- [ ] Environment variable strategy is documented and supports local development.
- [ ] Basic health-check API route exists and returns a successful response.
- [ ] Linting and formatting scripts are configured in `package.json`.
- [ ] README includes startup instructions and high-level architecture notes.
- [ ] CI-ready scripts exist for install, lint, and test/build commands.

## Background
This is a foundation issue for the MVP — subsequent issues (#2-#8) will build on this. The repo currently has only a README.md and .gitignore (possibly from a prior PO agent run on branch teacher-hub-mvp-foundation). The tech stack is Next.js (React) + Node.js API routes + PostgreSQL.
```
