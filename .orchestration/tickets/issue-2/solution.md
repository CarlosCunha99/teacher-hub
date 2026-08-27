# Solution: MVP teacher authentication with NextAuth v5 credentials

## Direction
Use NextAuth v5 with the credentials provider to handle registration, sign-in, sign-out, and session continuity for teacher accounts. The auth flow itself is self-contained within this ticket; persistence is kept behind a repository interface so that issue #3 can swap in PostgreSQL without rewriting the auth logic.

All authentication state is managed as a cookie-backed session that persists across page navigation and browser restarts until the teacher explicitly signs out or the session's configured max age elapses. Both protected pages and protected API endpoints must reject unauthenticated requests at the route level.

Explicit defaults are pinned now so that tests can be deterministic: minimum password length of 8 characters, no email verification step before first sign-in, and sign-in failure messages that do not distinguish between an unknown email and a wrong password.

## Key decisions
- Decided to use NextAuth v5 credentials provider because it integrates cleanly with the existing Next.js 15+ stack and keeps the solution within the established tech choices.
- Decided to abstract persistence behind a repository interface because issue #3 owns the PostgreSQL users table; this prevents the auth flow from being rewritten when the real database arrives.
- Decided no email verification for MVP because the ticket's "sign in after registering" criterion is asserted immediately and deferring verification keeps scope contained.
- Decided minimum password length of 8 with no complexity mandate as the password policy so tests have a concrete, deterministic rule to assert.
- Decided session persists until sign-out (with a default max age) rather than expiring on browser close, matching the "stays recognized" acceptance criterion.
- Decided sign-in errors do not reveal whether the email exists vs. the password was wrong, to prevent account enumeration.

## Explicitly rejected
- Email verification before first sign-in: adds scope and infrastructure (email sending) not requested for MVP.
- Strict password complexity (uppercase/number/symbol rules): over-specified for MVP; minimum length is sufficient for now.
- Session-on-close expiry (no persistence across browser restart): inconsistent with a "stays recognized" requirement and typical teacher usage patterns.
- Rate limiting / lockout on repeated failed sign-ins: deferred; not requested in this ticket and adds complexity beyond MVP scope.

## Open questions
- None. All ambiguities from the ticket were resolved with stated defaults during brainstorm.
