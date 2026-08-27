# Brainstorm — Issue 8: Build teacher profile pages with contributions and collections

**Started:** 2026-08-27 21:57:35Z  
**Ticket:** https://github.com/CarlosCunha99/teacher-hub/issues/8

---

## Brainstorm transcript

*The orchestrator opens the brainstorm. In autopilot mode, the orchestrator will lead the thinking based on the enriched ticket and repo patterns.*

### Initial thinking (orchestrator)

Looking at the enriched ticket.md and the repo context (a Next.js App Router skeleton with dependencies on #2, #3, #4, #7), the core design decisions are:

1. **Profile URL structure** — What path convention? The ticket doesn't specify. Likely `/teacher/[username]` or `/profile/[id]` or similar.
2. **Data model dependencies** — #3 (schema) needs to land first, or at least be aligned. The profile page reads from users, resources, and boards tables with visibility filters.
3. **Edit interface location** — The ticket says "account settings," but the repo has no settings pages yet (#2 or another ticket owns auth).
4. **Client vs server rendering** — With Next.js App Router, should this be a server component (fast, SEO-friendly) or hybrid? Server components can fetch and check permissions directly.
5. **Sharing/visibility model** — We resolved that boards have a `shareable` flag and resources have a published/draft state. Need to think about how this filters through.

The MVP scope is tight: list resources, list shareable boards, show counts, handle not-found. The edit flow is separate (it happens in account settings, owned by #2 or another ticket).

A sensible approach:
- **Profile page as a Next.js Server Component** (App Router convention) at `/teachers/[username]` or `/profile/[username]`
- Fetch user by username/handle on the server; check if user exists → 404 if not
- Query resources where `user_id = user.id AND state = 'published'`
- Query boards where `user_id = user.id AND shareable = true`
- Render counts alongside lists
- Keep edit flows out of this PR (belongs to #2 account settings)

Does this direction make sense to you?


### Orchestrator (developer proxy, autopilot)

The server-component approach aligns with App Router patterns and avoids extra client-side API calls. The `/teachers/[username]` route is clear and discoverable. Breaking out edit flows is correct — that's a future ticket.

**Direction locked:** Profile as Server Component at `/teachers/[username]`, fetching user + resources + boards server-side with visibility filters (published resources, shareable boards), returning 404 if user not found. Edit workflows deferred to account settings ticket.

Let's proceed with this direction.

