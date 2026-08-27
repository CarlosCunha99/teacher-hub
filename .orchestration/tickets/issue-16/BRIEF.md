# Branch Brief — issue-16

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:04:07Z at stage 01-enrich (gate: gate_1_enrich → passed at 2026-08-27T21:04:07Z)._

## The work
Free-tier teachers on Teacher Hub currently have unlimited downloads of shared
classroom resources. As Teacher Hub introduces a paid premium membership (#15), the
free tier needs a monthly cap on downloads so that heavy users are guided toward
upgrading and the two tiers are meaningfully differentiated. Without an enforced
limit, there is no product-level incentive to purchase premium, and Teacher Hub
cannot monetize its most active users.

## Where we are
- **Stage:** 01-enrich  →  next: 03-brainstorm
- **Last gate:** gate_1_enrich → passed at 2026-08-27T21:04:07Z
- **Next gate:** gate_1_enrich → approve enriched ticket / changes / Q&A
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
- 2026-08-27T21:04:07Z — 01-enrich — gate: Gate 1 passed in autopilot mode. Adopted enricher proposed answers: A2=soft-gate HTTP 402/403 with upgrade CTA, A3=calendar month UTC reset, A1=50/month default, A4=owner downloads fully exempt.

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-16/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-16/raw-context.md` |
| Full state / audit trail | `.orchestration/tickets/issue-16/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/01-enrich.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
