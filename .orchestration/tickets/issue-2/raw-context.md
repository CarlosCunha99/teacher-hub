# Raw context

Paste or append any unstructured context for the enricher here:

- related PRs / issues
- product documents
- Slack / chat excerpts
- customer reports
- screenshots or links
- constraints, history, or prior decisions

This file is intentionally raw input. The enricher reads it before rewriting
`ticket.md`; downstream agents should rely on the enriched ticket unless their
stage explicitly includes this file in their read allow-list.

---

## Context drop — 2026-08-27T21:12:55+01:00

- Previous issue #1 (Next.js foundation) is merged to main.
- Stack: Next.js 15+ with TypeScript, PostgreSQL.
- DB schema arrives in issue #3; auth should stay DB-agnostic now.
- Expected users table (issue #3): `id`, `email`, `password_hash`, `name`, `created_at`.
- Implementation recommendations:
  - Use `next-auth` (v5) for session management.
  - Use `bcryptjs` for password hashing.
  - Add auth API routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`.
  - Add middleware for protected routes.
  - Add minimal login/register UI.
  - Add comprehensive tests for flows.
