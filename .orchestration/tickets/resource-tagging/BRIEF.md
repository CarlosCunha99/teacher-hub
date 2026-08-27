# Branch Brief — resource-tagging

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:35:27Z at stage 08-verify (gate: gate_3_scope → passed at 2026-08-27T21:11:58Z)._

## The work
Teachers use Teacher Hub to share and discover classroom resources. The standard
subject/year-level taxonomy planned in issue #5 covers the most common filtering
needs, but teachers who work on niche interdisciplinary topics, follow a specific
institutional/exam-board curriculum, or teach highly specialised subjects cannot
adequately describe their resources with the fixed subject/year vocabulary alone.
As a result, valuable resources are either mis-tagged into the nearest standard

## Where we are
- **Stage:** 08-verify  →  next: 09-agent-review
- **Round:** 1 / 5
- **Last gate:** gate_3_scope → passed at 2026-08-27T21:11:58Z
- **Next gate:** gate_4_handoff → hand off to human review
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
- 2026-08-27T21:11:59Z — 05-plan — gate: Autopilot: scope approved. plan.md + test-plan.md (43 functional + 10 unit tests). Prisma+SQLite, CRUD+filter routes.
- 2026-08-27T21:05:50Z — 03-brainstorm — gate: Autopilot: brainstorm closed. Direction: teacher-scoped tags, Prisma+SQLite, minimal Resource stub, API-only.
- 2026-08-27T21:04:10Z — 01-enrich — gate: Autopilot: enrichment auto-approved (user unavailable). ticket.md has 12 ACs and rich edge cases.

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/resource-tagging/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/resource-tagging/raw-context.md` |
| Chosen approach (if brainstormed) | `.orchestration/tickets/resource-tagging/solution.md` |
| Technical plan | `.orchestration/tickets/resource-tagging/plan.md` |
| Test plan | `.orchestration/tickets/resource-tagging/test-plan.md` |
| Interface lock (parallel-work contract) | `.orchestration/tickets/resource-tagging/contract.md` |
| Subagent onboarding (patterns, utilities) | `.orchestration/tickets/resource-tagging/impl-context.md` |
| Impact scan (files, blast radius) | `.orchestration/tickets/resource-tagging/impact.md` |
| Full state / audit trail | `.orchestration/tickets/resource-tagging/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/08-verify.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
