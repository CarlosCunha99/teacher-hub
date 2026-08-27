# Branch Brief — issue-11

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:14:51Z at stage 06-contract (gate: gate_3_scope → passed at 2026-08-27T21:11:46Z)._

## The work
Problem statement not captured yet. Read `.orchestration/tickets/issue-11/ticket.md` once available.

## Where we are
- **Stage:** 06-contract  →  next: 07-implement
- **Last gate:** gate_3_scope → passed at 2026-08-27T21:11:46Z
- **Next gate:** gate_3_scope → approve plan and test-plan scope
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
- 2026-08-27T21:11:47Z — 05-plan — gate: Autopilot: scope approved — 11 steps, 6 new files, 6 modified, 14 tests
- 2026-08-27T21:05:34Z — 03-brainstorm — gate: Autopilot led brainstorm; agreed on Prisma+SQLite, query-time aggregates, Server Component profile, revalidatePath freshness
- 2026-08-27T21:03:57Z — 01-enrich — gate: Autopilot resolved A1-A4: data layer absorbed, revalidation freshness, public download, public stats

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-11/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-11/raw-context.md` |
| Chosen approach (if brainstormed) | `.orchestration/tickets/issue-11/solution.md` |
| Technical plan | `.orchestration/tickets/issue-11/plan.md` |
| Test plan | `.orchestration/tickets/issue-11/test-plan.md` |
| Interface lock (parallel-work contract) | `.orchestration/tickets/issue-11/contract.md` |
| Subagent onboarding (patterns, utilities) | `.orchestration/tickets/issue-11/impl-context.md` |
| Impact scan (files, blast radius) | `.orchestration/tickets/issue-11/impact.md` |
| Full state / audit trail | `.orchestration/tickets/issue-11/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/06-contract.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
