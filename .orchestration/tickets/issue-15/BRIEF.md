# Branch Brief — issue-15

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:36:17Z at stage 00-intake (gate: gate_3_scope → passed at 2026-08-27T21:09:38Z)._

## The work
*(❓ Unverified — no user, download, or billing code exists in the repo yet; problem framing is derived from the ticket text and sibling roadmap issues #16/#11, not from implemented behavior.)*
Teachers use Teacher Hub to download classroom resources shared by others. Phase 2 introduces a monthly free-tier download cap (tracked separately in issue #16). Once a teacher hits that cap, they are blocked from downloading more resources until the next billing month — even if they need materials immediately. There is currently no way for a motivated teacher to pay to remove that friction.
This ticket adds a **premium membership tier** so teachers who reach the free limit can upgrade and continue downloading (with higher or unlimited limits), plus the associated perks the ticket lists (extended storage, exclusive features). The goal is to give power users an escape hatch from the free-tier cap and to establish the platform's first paid revenue path.
**Ambiguity:** The ticket also mentions "extended storage" and "exclusive features" as premium perks. The title and user story scope this ticket to **download limits** only. See Enrichment notes.

## Where we are
- **Stage:** 00-intake  →  next: 01-enrich
- **Last gate:** gate_3_scope → passed at 2026-08-27T21:09:38Z
- **Next gate:** gate_1_enrich → approve enriched ticket / changes / Q&A
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
No decisions recorded yet.

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-15/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-15/raw-context.md` |
| Chosen approach (if brainstormed) | `.orchestration/tickets/issue-15/solution.md` |
| Technical plan | `.orchestration/tickets/issue-15/plan.md` |
| Test plan | `.orchestration/tickets/issue-15/test-plan.md` |
| Interface lock (parallel-work contract) | `.orchestration/tickets/issue-15/contract.md` |
| Subagent onboarding (patterns, utilities) | `.orchestration/tickets/issue-15/impl-context.md` |
| Impact scan (files, blast radius) | `.orchestration/tickets/issue-15/impact.md` |
| Code review verdict | `.orchestration/tickets/issue-15/code-review.md` |
| Full state / audit trail | `.orchestration/tickets/issue-15/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/00-intake.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
