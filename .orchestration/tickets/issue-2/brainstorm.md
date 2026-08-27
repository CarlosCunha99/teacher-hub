# Brainstorm transcript

### 2026-08-27 20:18 — dev
We should ship MVP auth with NextAuth v5 credentials and keep persistence behind a repository interface so issue #3 can swap in PostgreSQL without rewriting auth flow.

### 2026-08-27 20:19 — agent
Makes sense. If we do that, we should pin explicit defaults now for password policy, session lifetime, and route protection boundaries so tests can be deterministic.

### 2026-08-27 20:20 — dev
Agreed: minimum password length 8, no email verification for MVP, session persists until sign-out with a default max age, and both protected pages and API endpoints must reject unauthenticated access.

### 2026-08-27 20:21 — agent
That scope lines up with the acceptance criteria and keeps us database-agnostic while still validating end-to-end registration, login, logout, and guarded access.

### 2026-08-27 20:22 — dev
Let's go with this.
