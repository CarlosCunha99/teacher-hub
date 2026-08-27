# Branch Brief — issue-17

_Auto-generated. Do not edit. Regenerated at every state write, stage transition, and gate close._
_Last rendered: 2026-08-27T21:44:10Z at stage 07-implement (gate: gate_3_scope → passed at 2026-08-27T21:12:11Z)._

## The work
✅ **Verified** (from user session brief and product framing in README.md L1–L4)
Teachers using Teacher Hub can currently only discover and (per the Phase 2 roadmap) like/save resources. They have no way to leave feedback, ask the author a question, share how they used a resource in class, or discuss it with peers. When a resource is helpful — or has an issue (broken link, outdated content, wrong year level) — teachers have no channel to say so on the resource itself.
This is a gap in Teacher Hub's identity as a *collaborative teacher community* rather than a static file library. Without comments, resource quality signal is limited to download and like counts, and authors receive no textual feedback that would help them improve their materials.

## Where we are
- **Stage:** 07-implement  →  next: 08-verify
- **Round:** 2 / 5
- **Last gate:** gate_3_scope → passed at 2026-08-27T21:12:11Z
- **Next gate:** none scheduled
- **Escalated:** no

## Open questions / ambiguities
- spec-review blocking: src/lib/comments/__tests__/service.test.ts — issue: The service test file imports createComment, createReply, editComment, softDeleteComment, createNotificationForComment and createNotificationForReply — but never listComments. This one omission leaves the majority of the read-path contract unverified: ordering (created_at ASC, id ASC), reply nesting and reply ordering, the `replies` non-null invariant, the 'no replies at top level' invariant, cursor encode/decode, nextCursor null-on-last-page, the default limit of 20, and — most seriously — the soft-delete redaction (body -> 'This comment has been deleted', authorId -> null, authorName -> null, original body/author never exposed).
- spec-review blocking: src/lib/comments/__tests__/service.test.ts — issue: Both tests in the 'notification self-suppression' block assert `expect(mockDbInsert).not.toHaveBeenCalled()`. There is no counterpart asserting an insert DOES happen when actorId !== recipient, and no assertion on the inserted row's shape.
- spec-review blocking: src/app/api/resources/[resourceId]/comments/__tests__/route.test.ts — issue: The `expect.objectContaining` matcher checks resourceId, commentId and actorId — but not `resourceOwnerId`. The DB mock resolves `[{ ownerId: OWNER_ID }]`, yet no assertion confirms OWNER_ID reached the notification call. Same class of defect, worse, in replies/route.test.ts:172 which asserts only bare `toHaveBeenCalled()` with no argument matcher at all, leaving `parentCommentAuthorId` unchecked despite the DB mock supplying PARENT_AUTHOR_ID.

## Latest decisions
- 2026-08-27T21:06:34Z — 03-brainstorm — gate: Autopilot: closed brainstorm with Drizzle ORM + cursor-based pagination + auth-stub + soft-delete direction

## Sources of truth (read these, not this file)

| What you need | File |
|---|---|
| Product problem, ACs, edge cases | `.orchestration/tickets/issue-17/ticket.md` |
| Raw intake context for enrichment | `.orchestration/tickets/issue-17/raw-context.md` |
| Chosen approach (if brainstormed) | `.orchestration/tickets/issue-17/solution.md` |
| Technical plan | `.orchestration/tickets/issue-17/plan.md` |
| Test plan | `.orchestration/tickets/issue-17/test-plan.md` |
| Interface lock (parallel-work contract) | `.orchestration/tickets/issue-17/contract.md` |
| Subagent onboarding (patterns, utilities) | `.orchestration/tickets/issue-17/impl-context.md` |
| Impact scan (files, blast radius) | `.orchestration/tickets/issue-17/impact.md` |
| Full state / audit trail | `.orchestration/tickets/issue-17/state.json` |

_Only files that currently exist are listed. Others are omitted from the rendered brief._

## What to do next

- If you are a **NEW SUBAGENT**: read your role's declared inputs in `roles/<your-role>.md` plus the files above that your role is allowed to read. Do not read outside your allow-list.
- If you are RESUMING as the **ORCHESTRATOR**: read `state.json`, then open `stages/07-implement.md` and continue from where you left off.
- If you are a **HUMAN OPERATOR**: read this brief, then the file matching the last gate's context.

## Guardrails

- Independence rules apply to every subagent — see `docs/independence.md`.
- Do NOT edit this brief. It is a rendered view.
- Do NOT resolve a discrepancy by editing this brief; edit the source artefact and re-render.
