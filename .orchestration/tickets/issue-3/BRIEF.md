# Branch Brief — issue-3

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:08:04Z at stage 00-intake (gate: gate_2_brainstorm → passed at 2026-08-27T21:02:29Z)._

## The work
⚠️ **Inferred** (derived from issue #3 body plus the MVP issue set #4–#13; no data-model
artefacts exist in the repo yet — `find . -name "*.prisma"` returns nothing and there is no
`prisma/`, `db/`, or `migrations/` directory).
Teacher Hub currently has no persistence layer at all. The repository contains only the
Next.js application skeleton delivered by issue #1 (`src/app/`, `src/lib/health.ts`, a
deliberately database-free `/api/health` route). `.env.example` documents `DATABASE_URL`

## Where we are
- **Stage:** 00-intake  →  next: 01-enrich
- **Last gate:** gate_2_brainstorm → passed at 2026-08-27T21:02:29Z
- **Next gate:** gate_1_enrich → approve enriched ticket / changes / Q&A
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
No decisions recorded yet.

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-3/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-3/raw-context.md` |
| Chosen approach (if brainstormed) | `.orchestration/tickets/issue-3/solution.md` |
| Technical plan | `.orchestration/tickets/issue-3/plan.md` |
| Test plan | `.orchestration/tickets/issue-3/test-plan.md` |
| Impact scan (files, blast radius) | `.orchestration/tickets/issue-3/impact.md` |
| Full state / audit trail | `.orchestration/tickets/issue-3/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/00-intake.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
