# Branch Brief — issue-9

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:06:28Z at stage 04-impact (gate: gate_2_brainstorm → overridden at 2026-08-27T21:03:29Z)._

## The work
Teachers on Teacher Hub can share classroom resources, but the platform has no mechanism to make them acknowledge the legal terms governing ownership and permitted use of the content they upload. Without a recorded acceptance, the platform cannot demonstrate that a contributing teacher agreed to the current terms of use at the time they published, which is a legal/compliance exposure for user-generated content.
This ticket introduces a compliance gate: before a teacher publishes their **first** resource, they must accept the current version of the terms of use, and that acceptance must be durably recorded (who, when, which version). Uploads are blocked until acceptance exists for the current terms version.
> ❓ **Foundational dependency (Unverified):** The repository is currently only the Next.js skeleton (see `src/` — only a health-check route and home page exist). Authentication (#2), the PostgreSQL data model (#3), and the PDF upload workflow (#4) are all **open and unbuilt**. This feature cannot function end-to-end until at least those exist. Whether this ticket should (a) wait for them, (b) ship behind stubs, or (c) define only the terms-acceptance slice is a scoping decision for the human — see "Needs clarification".

## Where we are
- **Stage:** 04-impact  →  next: 05-plan
- **Last gate:** gate_2_brainstorm → overridden at 2026-08-27T21:03:29Z
- **Next gate:** gate_3_scope → approve plan and test-plan scope
- **Escalated:** no

## Open questions / ambiguities
- 2026-08-27T21:01:45Z — 01-enrich — question: Asked human to choose terms-version update behavior
- 2026-08-27T21:03:29Z — 03-brainstorm — question: Asked human to accept distilled solution

## Latest decisions
- 2026-08-27T21:03:29Z — 03-brainstorm — gate: No live human response; accepted distilled solution under autopilot
- 2026-08-27T21:01:45Z — 01-enrich — gate: No live human response; applied autopilot assumption: force re-acceptance on version bump

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-9/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-9/raw-context.md` |
| Chosen approach (if brainstormed) | `.orchestration/tickets/issue-9/solution.md` |
| Impact scan (files, blast radius) | `.orchestration/tickets/issue-9/impact.md` |
| Full state / audit trail | `.orchestration/tickets/issue-9/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/04-impact.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
