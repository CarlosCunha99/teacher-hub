# Branch Brief — issue-2

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T20:25:16Z at stage 06-contract (gate: gate_3_scope → overridden at 2026-08-27T20:25:15Z)._

## The work
✅ **Verified** (repo has no auth surface: `src/app/page.tsx` renders a static "Teacher Hub" main, the only API route is the database-free health check in `src/app/api/health/route.ts`, and `.env.example` notes auth variables "arrive in issues #2 and #3").
Teacher Hub is a platform for teachers to share and discover classroom resources, but today there is no way for a teacher to have an identity on the platform. Anyone visiting the app sees the same anonymous surface, and there is no concept of an account, a signed-in user, or a protected area. Because of this, teachers cannot own the content they contribute or reliably return to content they have saved.
This ticket establishes the first identity boundary for the product: letting a teacher create an account, prove who they are on return visits, stay recognized across a session, and deliberately end that session. It is the prerequisite for every downstream MVP capability (uploads, saves/boards, profiles) that must be attributed to a specific teacher.

## Where we are
- **Stage:** 06-contract  →  next: 07-implement
- **Last gate:** gate_3_scope → overridden at 2026-08-27T20:25:15Z
- **Next gate:** gate_3_scope → approve plan and test-plan scope
- **Escalated:** no

## Open questions / ambiguities
None open.

## Latest decisions
- 2026-08-27T20:25:15Z — 05-plan — answer: Autonomous mode: scope approved
- 2026-08-27T20:17:25Z — 03-brainstorm — answer: Autonomous mode: accepted distilled direction
- 2026-08-27T20:16:19Z — 01-enrich — answer: Autonomous mode: proceed with documented defaults

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-2/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-2/raw-context.md` |
| Chosen approach (if brainstormed) | `.orchestration/tickets/issue-2/solution.md` |
| Technical plan | `.orchestration/tickets/issue-2/plan.md` |
| Test plan | `.orchestration/tickets/issue-2/test-plan.md` |
| Impact scan (files, blast radius) | `.orchestration/tickets/issue-2/impact.md` |
| Full state / audit trail | `.orchestration/tickets/issue-2/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/06-contract.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
