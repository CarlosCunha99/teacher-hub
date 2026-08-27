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

## Context drop — 2026-08-27T20:58:30Z

Use the agentic-ticket-to-pr skill to implement GitHub issue #9 in CarlosCunha99/teacher-hub: '[MVP] Require terms of use acceptance before first resource upload'.

Acceptance criteria:
- [ ] Terms of service text is stored and versioned in the application.
- [ ] On first upload attempt, unagreeing teachers see a modal with terms and a checkbox to accept.
- [ ] Terms acceptance is recorded in the database with timestamp and version.
- [ ] Upload is blocked until teacher accepts the current terms version.
- [ ] Teachers who have accepted are not re-prompted on subsequent uploads.
- [ ] Notification or reminder appears if terms are updated to a new version.

Implement legal compliance layer requiring terms acceptance before uploads.
