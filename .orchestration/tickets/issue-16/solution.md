# Solution: Lazy-reset monthly download counter with atomic enforcement

## Direction

Enforce a monthly download cap for free-tier users at the API layer, inside the download endpoint (issue #11). Before any file stream begins, the handler authenticates the caller, checks their tier, and — for free-tier users who are not the resource owner — runs an atomic check-and-increment against a per-user, per-month counter. The counter is stored in a dedicated database table keyed by user, year, and month (UTC calendar month).

The reset mechanism is lazy: no scheduled job exists. Instead, the counter check always targets the current UTC year and month. A row from a prior month is treated as zero; a missing row is inserted. This means the "reset" happens implicitly the first time a user downloads in a new month.

Concurrent requests are handled at the database level with an atomic upsert that increments and returns the new count in a single operation. If the returned count exceeds the configured limit, the request is rejected with a 402 response carrying a structured body that includes the limit, the UTC reset timestamp, and an upgrade URL — giving the frontend everything it needs to render an upgrade CTA.

A lightweight quota endpoint exposes current usage, limit, and reset timestamp to the frontend. A UI indicator in the account or header area reads from this endpoint on page load and displays remaining downloads to free users. Premium users see no indicator or an "Unlimited" label.

## Key decisions

- Decided to use a lazy-reset table keyed by `(user_id, year, month)` because it eliminates any scheduled reset job and answers the "is it the current month?" question at query time.
- Decided that the unit of counting is "download authorized," not "bytes delivered," because HTTP response headers are sent before the stream completes, making mid-stream rollback impossible.
- Decided to use calendar month UTC (not a per-user rolling 30-day window) because it is simpler to implement, easier to communicate to users, and free users have no subscription anniversary to anchor against.
- Decided on a 402 response with structured JSON body (`code`, `limit`, `reset_at`, `upgrade_url`) so the frontend can render a contextual upgrade CTA without client-side computation.
- Decided the configurable allowance is read from an env var (`FREE_TIER_MONTHLY_DOWNLOAD_LIMIT`), defaulting to 50, so operators can adjust it without a code change.
- Decided owner downloads bypass the limit check entirely and do not count against the owner's allowance.

## Explicitly rejected

- **Scheduled reset job:** adds operational complexity and requires a babysit-able cron; the lazy-reset pattern achieves the same result without it.
- **Per-user 30-day rolling window:** significantly more complex to store and query; harder to communicate to users; free users have no subscription event to anchor the window.
- **Decrementing on stream failure:** headers are already sent by the time a stream error occurs; rollback is not atomically achievable at the HTTP layer.
- **Hard block with generic error at the limit:** fails the product goal of driving premium conversions; a structured 402 with upgrade context is the intended behavior.

## Open questions

- None. All blocking ambiguities (A2: soft-gate behavior; A3: calendar-month UTC) were resolved during the brainstorm. The default allowance value (50) is a placeholder pending product-owner confirmation but is non-blocking.
