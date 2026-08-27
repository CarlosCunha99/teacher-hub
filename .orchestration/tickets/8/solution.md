# Solution: Public teacher profile page as Server Component

## Direction
We are building a public teacher profile page at `/teachers/[username]` using Next.js App Router conventions. The page is a server component that fetches all required data server-side on request: the teacher record (by username/handle), their published resources, and their shareable boards.

Visibility filtering is applied at the data layer: only resources in a published state and boards explicitly marked as shareable are returned and counted. If the requested username does not correspond to an existing user, the page returns a proper 404 not-found response.

Profile editing (name and bio) is out of scope for this page. That capability belongs in the account settings surface, which is owned by the authentication ticket (#2). This ticket delivers only the public read view.

The users table is assumed to expose `name`, `bio`, and a `joined_at` timestamp; boards are assumed to carry a per-record `shareable` boolean flag; resources are assumed to carry a state field distinguishing published from draft/private. These fields are the responsibility of the schema ticket (#3) — this ticket consumes them.

## Key decisions
- Decided to use a Next.js App Router Server Component at `/teachers/[username]` because it aligns with App Router conventions, delivers SEO-friendly server-rendered HTML, and avoids extra client-side API round-trips.
- Decided that only published resources and explicitly shareable boards appear on the profile, and are included in counts, because the ticket language ("boards intended for sharing") requires an opt-in model.
- Decided to return a 404 for non-existent usernames because the acceptance criteria explicitly require a proper not-found state rather than an error or blank page.
- Decided to defer profile editing to the account settings ticket (#2) because the brainstorm confirmed it is a distinct concern and no settings surface exists yet.
- Decided `joined_date` is read-only and system-managed; only `name` and `bio` are user-editable (though editing itself is out of scope here).

## Explicitly rejected
- Client-side data fetching: rejected because Server Components provide the same result with better performance and simpler auth/permission checks.
- Showing all boards regardless of shareable flag: rejected because the ticket specifies "boards intended for sharing" — an implicit opt-in model.
- Building profile editing in this ticket: rejected because it belongs to the account settings surface (#2) and adds scope beyond the read view.

## Open questions
- None. All blocking ambiguities were resolved during enrichment/brainstorm via autopilot defaults.
