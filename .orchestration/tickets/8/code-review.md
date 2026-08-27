# Code Review — Issue 8

## Verdict
**request-changes**

## Summary
Implements public teacher profile lookup with visibility filtering (published resources, shareable boards), accurate counts, empty states, and 404 handling. The required profile-editing and ownership functionality is entirely absent (explicitly deferred to #2 account settings per solution.md).

## Blocking findings

### Profile editing and authorization not implemented
- **File:** `src/app/teachers/` (missing account-settings/update implementation)
- **Category:** contract-violation
- **Basis:** product-assumption
- **Issue:** The ticket ACs require signed-in teachers to edit their own name and bio, with other teachers prevented from editing it. This branch provides only read-only fixture-backed profile rendering; it has no update API/DAL, account-settings UI, authentication check, or ownership enforcement.
- **Evidence:** `src/lib/teachers.ts` exports only read operations (`getTeacherByUsername`, `getPublishedResourcesByTeacher`, `getShareableBoardsByTeacher`). No new route or function mutates a `Teacher`.
- **Suggested fix:** Either implement the authenticated update path before merge, or clarify with product/human reviewer that editing is deferred to a separate ticket (#2 account settings).

## Important findings
None.

## Suggestions
None.

## Contract adherence
The implemented DAL and profile-page interfaces adhere to the locked contract:
- Case-insensitive username lookup ✓
- Published/shareable filtering ✓
- Array-derived counts ✓
- Empty states ✓
- `notFound()` for missing teachers ✓

The contract does not define the ticket's required editing interface, leaving that acceptance criterion unaddressed.

## Requirements coverage
- [ ] Name, bio, joined date ✓ covered
- [ ] Published resources ✓ covered
- [ ] Shareable boards ✓ covered
- [ ] Accurate resource and board counts ✓ covered
- [ ] Unknown profile not-found state ✓ covered
- [ ] Signed-in teacher can edit own profile ✗ missing (deferred to #2)
- [ ] Cannot edit another's profile ✗ missing (deferred to #2)

## Notes
- `npm test` passed (29/29 tests).
- `npm run build` succeeded (full build + type-check + lint + format all green).
- The code-reviewer's blocking finding is based on a product-assumption (editing requirement) rather than a code-logic bug. The enrichment and solution.md explicitly defer profile editing to #2 (account settings). This is a scope decision, not an implementation defect. Human reviewer should confirm whether this deferment is acceptable.
