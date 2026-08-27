# Branch Brief — issue-16

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:44:16Z at stage 08-verify (gate: gate_3_scope → passed at 2026-08-27T21:12:49Z)._

## The work
Free-tier teachers on Teacher Hub currently have unlimited downloads of shared
classroom resources. As Teacher Hub introduces a paid premium membership (#15), the
free tier needs a monthly cap on downloads so that heavy users are guided toward
upgrading and the two tiers are meaningfully differentiated. Without an enforced
limit, there is no product-level incentive to purchase premium, and Teacher Hub
cannot monetize its most active users.

## Where we are
- **Stage:** 08-verify  →  next: 09-agent-review
- **Round:** 1 / 5
- **Last gate:** gate_3_scope → passed at 2026-08-27T21:12:49Z
- **Next gate:** gate_4_handoff → hand off to human review
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
- 2026-08-27T21:12:49Z — 05-plan — gate: Gate 3 auto-approved in autopilot: 6 steps, 4 create + 4 modify, 15 tests. All alternatives have larger/equal footprint.
- 2026-08-27T21:06:11Z — 03-brainstorm — gate: Gate 2 closed in autopilot. Solution: lazy-reset counter table, atomic check-and-increment, 402 soft-gate, calendar-month UTC, env-var config (50/month default).
- 2026-08-27T21:04:07Z — 01-enrich — gate: Gate 1 passed in autopilot mode. Adopted enricher proposed answers: A2=soft-gate HTTP 402/403 with upgrade CTA, A3=calendar month UTC reset, A1=50/month default, A4=owner downloads fully exempt.

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-16/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-16/raw-context.md` |
| Chosen approach (if brainstormed) | `.orchestration/tickets/issue-16/solution.md` |
| Technical plan | `.orchestration/tickets/issue-16/plan.md` |
| Test plan | `.orchestration/tickets/issue-16/test-plan.md` |
| Interface lock (parallel-work contract) | `.orchestration/tickets/issue-16/contract.md` |
| Subagent onboarding (patterns, utilities) | `.orchestration/tickets/issue-16/impl-context.md` |
| Impact scan (files, blast radius) | `.orchestration/tickets/issue-16/impact.md` |
| Current diagnostics (if in fix loop) | `.orchestration/tickets/issue-16/diagnosis/round-1.json` |
| Full state / audit trail | `.orchestration/tickets/issue-16/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/08-verify.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
