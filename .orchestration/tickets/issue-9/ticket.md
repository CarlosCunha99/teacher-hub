# Require terms of use acceptance before first resource upload

**Type:** feature
**Source:** https://github.com/CarlosCunha99/teacher-hub/issues/12 (tracked in this pipeline as `issue-9`)

> ⚠️ **Numbering note (Inferred):** The invocation labels this "issue #9", but the live GitHub issue matching this title is **#12** ("[MVP] Require terms of use acceptance before first resource upload"). Issue #9 in the API is a *pull request* for the Next.js foundation (issue #1). This ticket treats **#12** as the source of truth for upstream acceptance criteria and reconciles it with the invocation text. Confirm the correct issue number at the gate.

## Problem
Teachers on Teacher Hub can share classroom resources, but the platform has no mechanism to make them acknowledge the legal terms governing ownership and permitted use of the content they upload. Without a recorded acceptance, the platform cannot demonstrate that a contributing teacher agreed to the current terms of use at the time they published, which is a legal/compliance exposure for user-generated content.

This ticket introduces a compliance gate: before a teacher publishes their **first** resource, they must accept the current version of the terms of use, and that acceptance must be durably recorded (who, when, which version). Uploads are blocked until acceptance exists for the current terms version.

> ❓ **Foundational dependency (Unverified):** The repository is currently only the Next.js skeleton (see `src/` — only a health-check route and home page exist). Authentication (#2), the PostgreSQL data model (#3), and the PDF upload workflow (#4) are all **open and unbuilt**. This feature cannot function end-to-end until at least those exist. Whether this ticket should (a) wait for them, (b) ship behind stubs, or (c) define only the terms-acceptance slice is a scoping decision for the human — see "Needs clarification".

## Impact
- **Users affected:** All teachers who upload resources (i.e. every contributor). ⚠️ Inferred — no user metrics available in-repo.
- **Severity:** high — it is an MVP legal-compliance requirement gating a core action (uploading). ✅ Verified from issue labels (`mvp`, `legal`) on #12.
- **Frequency:** always — the check runs on every upload attempt; the acceptance prompt occurs once per teacher (per terms version). ⚠️ Inferred.

## Success criteria
- A teacher who has not accepted the current terms cannot publish a resource. ✅ Verified (explicit in #12 and invocation).
- A teacher who has accepted the current terms can upload without seeing the terms prompt again. ✅ Verified (invocation) / ⚠️ Inferred (implied by #12).
- For every acceptance, the system can report **which teacher** accepted **which terms version** at **what time**. ✅ Verified (explicit in #12 and invocation).
- A teacher can review the terms version they accepted from their account/settings area. ✅ Verified (explicit in #12).

## Acceptance criteria
- [ ] The terms-of-use text is stored in the application and carries an explicit, comparable **version** identifier. ✅ Verified (invocation) / ⚠️ Inferred storage location.
- [ ] A teacher who has not accepted the current terms version is prevented from completing their first resource upload and is presented with the current terms and an explicit affirmative acceptance control (e.g. a checkbox they must tick before continuing). ✅ Verified (invocation + #12).
- [ ] The upload request path (server-side) rejects uploads from teachers who have no acceptance record for the current terms version — the block cannot be bypassed by skipping the UI. ✅ Verified (#12: "Upload API blocks requests from users without accepted terms").
- [ ] When a teacher accepts, the system records an acceptance consisting of at least: the teacher's identity, the accepted terms **version**, and a **timestamp**. ✅ Verified (#12 + invocation).
- [ ] A teacher who has already accepted the current terms version is **not** re-prompted on subsequent uploads. ✅ Verified (invocation).
- [ ] A teacher can view which terms version they accepted (and when) from their account/settings area. ✅ Verified (#12: "review the accepted terms version in account settings").
- [ ] The terms of use content is reachable as a readable page/view that can be linked from the acceptance prompt (and, per #12, from the authentication and upload flows). ⚠️ Inferred — #12 says "Terms of use page exists and is accessible from authentication and upload flows"; the invocation frames it as an inline modal. See Ambiguity (presentation).
- [ ] When the terms are updated to a new version, previously-accepted teachers are informed and/or required to act before their next upload. ❓ **Unverified / behavior undecided** — see Ambiguity (version-update behavior), marked blocking.

## Edge cases & non-functional
- **Version bump semantics:** If the current terms version changes after a teacher accepted an older version, does the block re-engage on their next upload (forcing re-acceptance), or is it a non-blocking notification only? This changes the assertion of the last two ACs. ❓ Unverified — blocking.
- **Race / concurrency:** Two concurrent first-upload attempts from the same teacher must not create duplicate or conflicting acceptance records. ⚠️ Inferred good practice.
- **Server-authoritative enforcement:** The gate must be enforced server-side (not only in the UI), since the AC explicitly calls out the upload API. ✅ Verified (#12).
- **Auditability / immutability:** Acceptance records should be retained for legal evidence (append-only rather than overwritten on re-acceptance). ⚠️ Inferred from "legal compliance" intent.
- **Unauthenticated / identity dependency:** Acceptance is tied to a teacher identity, which depends on authentication (#2). ❓ Unverified dependency.
- **Accessibility:** The acceptance prompt (modal or page) and its control must be keyboard-navigable and screen-reader accessible. ⚠️ Inferred standard requirement; no a11y conventions found in-repo.
- **Content/versioning source:** Whether terms text/versions live in code, config, or the database (#3) is undecided. ❓ Unverified.

## Out of scope
- Drafting the actual legal wording of the terms of use (a product/legal content task, not covered here). ⚠️ Inferred.
- Building authentication (#2), the PostgreSQL schema (#3), or the upload workflow itself (#4) — this ticket adds the acceptance gate on top of them. ✅ Verified those are separate open issues.
- Per-resource licensing choices, download-side terms, or premium/billing terms (#15/#16). ⚠️ Inferred.
- Localisation/translation of the terms text. ⚠️ Inferred.

## References
- Original issue: https://github.com/CarlosCunha99/teacher-hub/issues/12
- Related — Authentication & sessions: https://github.com/CarlosCunha99/teacher-hub/issues/2
- Related — PostgreSQL schema: https://github.com/CarlosCunha99/teacher-hub/issues/3
- Related — PDF upload & sharing workflow: https://github.com/CarlosCunha99/teacher-hub/issues/4
- Related — Restrict uploads to PDF (CLOSED): https://github.com/CarlosCunha99/teacher-hub/issues/10
- Repo skeleton evidence: `src/app/`, `src/lib/health.ts`, `README.md`

## Raw context used
- `.orchestration/tickets/issue-9/raw-context.md` → "Context drop — 2026-08-27T20:58:30Z": the invocation text and the six acceptance criteria (versioned TOS text, first-upload modal with checkbox, recorded acceptance with timestamp+version, upload blocked until acceptance, no re-prompt after acceptance, notification/reminder on terms update).
- `ticket.md` intake snapshot noting the issue-title/number mismatch (API returned the foundation issue title).

## Enrichment notes
- The invocation and GitHub issue #12 mostly agree, but differ in two places, surfaced below as ambiguities: **presentation** (inline modal vs dedicated terms page) and **version-update behavior** (notification vs forced re-acceptance).
- The invocation added "Notification or reminder appears if terms are updated to a new version," which #12 does not mention. I did not fabricate an assertion about whether this re-blocks uploads; it is left as a blocking ambiguity.
- **Ambiguity (issue number):** Proposed reading: this is GitHub issue **#12**, tracked as pipeline id `issue-9`. Alternative rejected: literally issue #9 (that is the foundation PR, unrelated). blocking: no.
- **Ambiguity (presentation):** Proposed reading: teachers accept via an affirmative control (checkbox) at the point of first upload, with the full terms viewable (a linked/embedded terms view). Whether that is a blocking modal or a separate page is a UX choice deferred to solution design. Alternatives: strictly a standalone page (#12 wording) vs strictly an inline modal (invocation wording). blocking: no.
- **Ambiguity (version-update behavior):** Proposed reading: on a terms **version bump**, previously-accepted teachers must re-accept before their next upload (the block re-engages), because that best serves the legal-compliance goal. Alternative: a non-blocking notification only, leaving the old acceptance valid. **Autopilot assumption applied due unavailable human gate response:** proceed with forced re-acceptance. blocking: no.

## Needs clarification
The following sections are ⚠️ Inferred or ❓ Unverified and should be confirmed by the human **before** brainstorming/planning:
1. **Version-update behavior (❓, resolved by assumption):** On a new terms version, proceed with (a) forced re-acceptance before next upload unless the human later overrides.
2. **Scope vs dependencies (❓):** Auth (#2), DB (#3), and upload (#4) are unbuilt. Should this ticket wait for them, build against stubs, or deliver only the isolated acceptance-gate slice?
3. **Presentation (⚠️):** Inline modal at first upload (invocation) vs standalone terms page linked from auth + upload flows (#12) — which is required for MVP?
4. **Storage of terms text/versions (❓):** In code/config vs the database (#3)?
5. **Issue number (⚠️):** Confirm this pipeline (`issue-9`) targets GitHub issue **#12**.

**Recommendation to orchestrator:** Ask the user items 1–3 (at minimum item 1, which is blocking) before proceeding to brainstorm. Do not present the inferred version-update behavior as settled.

---
## Original

**Repository:** `CarlosCunha99/teacher-hub`
**Issue (per invocation):** `#9` — reconciled to GitHub issue `#12`
**URL:** `https://github.com/CarlosCunha99/teacher-hub/issues/9`

### Issue title (from invocation)

[MVP] Require terms of use acceptance before first resource upload

### Original request

Implement legal compliance layer requiring terms acceptance before uploads.

### Acceptance criteria (as provided in invocation)

- [ ] Terms of service text is stored and versioned in the application.
- [ ] On first upload attempt, unagreeing teachers see a modal with terms and a checkbox to accept.
- [ ] Terms acceptance is recorded in the database with timestamp and version.
- [ ] Upload is blocked until teacher accepts the current terms version.
- [ ] Teachers who have accepted are not re-prompted on subsequent uploads.
- [ ] Notification or reminder appears if terms are updated to a new version.

### Upstream GitHub issue #12 acceptance criteria

- [ ] Terms of use page exists and is accessible from authentication and upload flows.
- [ ] A user must accept the current terms version before first upload.
- [ ] Terms acceptance stores timestamp and terms version per user.
- [ ] Upload API blocks requests from users without accepted terms.
- [ ] Users can review the accepted terms version in account settings.

### Raw fetched issue snapshot note

The intake API snapshot for issue `#9` returned the title
`[MVP] Initialize Next.js project foundation and developer workflow` (the foundation
issue/PR). The orchestrator continued using the user-provided issue title and criteria.
