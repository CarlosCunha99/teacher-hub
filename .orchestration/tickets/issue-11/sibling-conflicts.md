# Sibling PR Conflict Check — issue-11

Checked at: 2026-08-27T23:00Z  
Our branch: `issue-10-mvp-add-resource-download-endpoint-and-2788c3`  
Base: `main`

## Overlapping PRs

| PR | Title | Branch | Overlap severity |
|----|-------|--------|-----------------|
| #23 | [MVP] Surface total likes and total downloads on teacher profile | `issue-11-mvp-surface-total-likes-and-total-downl-3b3be3` | **HIGH** |

PRs #22, #24, #25, #26, #27 — no path overlap.

---

## PR #23 — Detailed Conflict Analysis

### Shared changed files

| File | Our change | PR #23 change | Conflict risk |
|------|-----------|----------------|---------------|
| `src/app/api/resources/[id]/download/route.ts` | GET streaming endpoint, auth-required, JSON store | POST stub endpoint, no auth, Prisma `db.download.create`, returns `fileUrl` | **BREAKING** — different HTTP method, different architecture |
| `src/app/resources/[id]/page.tsx` | Server component; reads JSON store; shows `downloadCount` + `<a href=...>` link | Server component; reads Prisma; shows `downloadCount` + form POST | **HIGH** — both rewrite this file from scratch |
| `src/components/ResourceCard.tsx` | Props: `{ resource: Omit<Resource, 'filePath'> }` (nested object) | Props: `{ id, title, downloadCount }` (individual spread props) | **HIGH** — incompatible prop shapes; both files are authoritative |
| `src/app/api/resources/[id]/download/__tests__/route.test.ts` | 10 tests for GET streaming (fetch mock) | Tests for POST stub | **HIGH** — different test suite targets |
| `src/app/resources/[id]/__tests__/page.test.ts` | Tests for our page (JSON store mock) | Tests for their page (Prisma mock) | **HIGH** — different test suite targets |
| `.env.example` | Added DATA_DIR, UPLOADS_DIR, TEST_USER_ID | Added DIRECT_URL, modified DATABASE_URL | Merge conflict on `.env.example` — low risk, manual merge trivial |
| `package.json` | Added @testing-library/react, jsdom devDeps | Added Prisma, @prisma/client | Merge conflict in deps — low risk, both can coexist |

### Architectural divergence

- **PR #23**: Moves to Prisma/PostgreSQL. Download tracking is `db.download.create`. No auth. Endpoint is `POST`, returns JSON with `fileUrl` for client to fetch separately.  
- **Our PR**: JSON file store. Download tracking in `data/audit.json`. Auth required. Endpoint is `GET`, streams PDF binary. Counter tied to full delivery.

These are **mutually exclusive approaches** for `download/route.ts`, `resources/[id]/page.tsx`, and `ResourceCard.tsx`. Whichever PR merges second will need manual conflict resolution.

### Recommendation: `flag-in-pr-body`

The two PRs cannot be auto-rebased into alignment because they represent different architecture choices (JSON vs PostgreSQL, GET streaming vs POST redirect). The repo owner must decide:

1. **Accept both** in sequence: merge issue-11 (streaming download + JSON store) first as the MVP, then let PR #23 (Prisma migration + stats surface) resolve conflicts when it lands.
2. **Supersede**: if PR #23's Prisma direction is the decided future, our JSON store could be adapted after the fact.

The conflict summary is surfaced in the PR body's Notes section.

