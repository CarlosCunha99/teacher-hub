# Branch Brief — resource-tagging

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:04:10Z at stage 00-intake (gate: gate_1_enrich → passed at 2026-08-27T21:04:10Z)._

## The work
Teachers use Teacher Hub to share and discover classroom resources. The standard
subject/year-level taxonomy planned in issue #5 covers the most common filtering
needs, but teachers who work on niche interdisciplinary topics, follow a specific
institutional/exam-board curriculum, or teach highly specialised subjects cannot
adequately describe their resources with the fixed subject/year vocabulary alone.
As a result, valuable resources are either mis-tagged into the nearest standard

## Where we are
- **Stage:** 00-intake  →  next: 01-enrich
- **Last gate:** gate_1_enrich → passed at 2026-08-27T21:04:10Z
- **Next gate:** gate_1_enrich → approve enriched ticket / changes / Q&A
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
- 2026-08-27T21:04:10Z — 01-enrich — gate: Autopilot: enrichment auto-approved (user unavailable). ticket.md has 12 ACs and rich edge cases.

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/resource-tagging/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/resource-tagging/raw-context.md` |
| Full state / audit trail | `.orchestration/tickets/resource-tagging/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/00-intake.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
