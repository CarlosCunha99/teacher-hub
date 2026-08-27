# Branch Brief — issue-11

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T20:59:21Z at stage 00-intake (gate: none → pending)._

## The work
Teachers on the platform currently have no way to see the aggregate impact of the resources they've shared. A teacher's profile page should surface community engagement metrics — specifically how many times their published resources have been liked and downloaded in total — so they can understand the usefulness of their contributions at a glance.
The platform needs both the data layer (tracking download events and counting likes) and the presentation layer (a stats section on the teacher profile header card) to fulfill this feature.

## Where we are
- **Stage:** 00-intake  →  next: 01-enrich
- **Last gate:** none → pending
- **Next gate:** gate_1_enrich → approve enriched ticket / changes / Q&A
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
No decisions recorded yet.

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-11/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-11/raw-context.md` |
| Full state / audit trail | `.orchestration/tickets/issue-11/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/00-intake.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
