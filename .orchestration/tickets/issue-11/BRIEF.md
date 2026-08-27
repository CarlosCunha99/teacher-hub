# Branch Brief — issue-11

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:03:03Z at stage 01-enrich (gate: gate_1_enrich → passed at 2026-08-27T21:03:02Z)._

## The work
Teachers use Teacher Hub to share PDF classroom resources with other teachers. Today
the platform has no way for a user to actually download those PDFs, so even resources
that exist in the system cannot be consumed. In parallel, teachers who contribute
resources have no signal about which of their materials are useful, because nothing is
counting downloads.
Two product gaps flow from this: (1) resources are effectively "look but don't touch,"

## Where we are
- **Stage:** 01-enrich  →  next: 03-brainstorm
- **Last gate:** gate_1_enrich → passed at 2026-08-27T21:03:02Z
- **Next gate:** gate_1_enrich → approve enriched ticket / changes / Q&A
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
- 2026-08-27T21:03:03Z — 01-enrich — gate: User unavailable — autonomous progression: enrichment captures all ACs, no blocking ambiguities

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-11/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-11/raw-context.md` |
| Full state / audit trail | `.orchestration/tickets/issue-11/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/01-enrich.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
