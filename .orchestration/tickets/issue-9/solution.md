# Solution: Server-enforced terms-of-use acceptance gate

## Direction

We are adding a legal-compliance gate that requires every teacher to accept the current version of the terms of use before completing any resource upload. The gate operates at two levels: the UI surfaces an acceptance prompt (modal with checkbox) on the first upload attempt, and the server-side upload path independently blocks requests from teachers who lack a valid acceptance record for the current terms version. The UI layer is supplementary; the API is authoritative.

Terms text and the current version identifier are stored in application configuration for MVP, keeping the solution self-contained without requiring a dedicated admin interface. When a teacher accepts, the system writes an immutable acceptance record to the database containing at minimum their identity, the accepted terms version, and a timestamp.

When the configured terms version changes, any teacher whose most-recent acceptance references an older version is treated as not-yet-accepted: the upload block re-engages and they are shown a reminder in the upload area and settings before their next upload. Previously accepted versions are retained for audit purposes rather than overwritten.

A dedicated terms page is also provided so the acceptance prompt can link to the full text, and so the terms are reachable from authentication and upload flows per the upstream requirements. Teachers can also view the version and timestamp of their own acceptance from their account settings.

## Key decisions

- Decided to enforce the gate server-side (not UI-only) because client-side enforcement can be bypassed; the API must be authoritative.
- Decided to store terms text and version in app config (not the database) for MVP to avoid extra schema complexity while foundational issues are still open.
- Decided to require re-acceptance (not just a notification) when the terms version changes, because forced re-acceptance best serves the legal-compliance goal.
- Decided acceptance records are append-only to preserve audit history.

## Explicitly rejected

- UI-only gate: rejected because it can be bypassed without an API check.
- Non-blocking notification on version update: rejected in favour of forced re-acceptance, as a notification alone does not constitute a new legal consent.
- Storing terms in the database: rejected for MVP as it adds admin-interface scope beyond what the issue requires.

## Open questions

- None. Version-update behaviour (forced re-acceptance) and terms storage (app config) were resolved during brainstorm.
