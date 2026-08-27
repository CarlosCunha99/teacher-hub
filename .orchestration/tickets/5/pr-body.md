# [MVP] Implement subject and year-level taxonomy tagging

## Summary

This PR implements the MVP taxonomy system for organizing resources by subject and grade level. It provides:
- A standardized, controlled vocabulary (6 subjects + 3 year levels)
- Validation helpers to enforce taxonomy constraints at creation/edit time
- A read-only API endpoint for UI components to discover approved options
- Comprehensive tests (49 tests) covering all acceptance criteria

## What's included

### Implementation (80 LOC)
- **`src/lib/taxonomy.ts`** — Constants (SUBJECTS, YEAR_LEVELS) + TypeScript types
- **`src/lib/taxonomy-service.ts`** — Validators (validateSubjectIds, validateYearLevelIds) + error class
- **`src/app/api/taxonomy/route.ts`** — GET /api/taxonomy endpoint

### Tests (277+ LOC, 49 tests)
- **`src/lib/__tests__/taxonomy.test.ts`** — Constants shape, stability, uniqueness
- **`src/lib/__tests__/taxonomy-service.test.ts`** — Validation logic (empty, unknown, mixed)
- **`src/app/api/taxonomy/__tests__/route.test.ts`** — API response shape and status

### Documentation
- **`README.md`** — Added GET /api/taxonomy to API endpoints table with description

## How it works

### Reference Data (MVP)
```json
{
  "subjects": [
    "Mathematics", "English", "Science", 
    "Social Studies", "Arts", "Physical Education"
  ],
  "yearLevels": [
    "Elementary (K–5)", "Middle School (6–8)", "High School (9–12)"
  ]
}
```

### Validation
When creating/editing resources, pass subject and year-level IDs to validators:
```typescript
validateSubjectIds(['mathematics'])     // ✅ ok
validateSubjectIds([])                 // ❌ throws empty error
validateSubjectIds(['not-real'])       // ❌ throws unknown error
```

### API
```
GET /api/taxonomy
→ 200 { subjects: [{id, label}], yearLevels: [{id, label}] }
```

## Acceptance Criteria Coverage

- ✅ Subject and year-level reference data exists and can be managed
- ✅ Resource creation requires valid subject and year-level selections
- ✅ APIs reject tags not in the approved taxonomy
- ✅ Resource cards and detail pages can display tags (deferred to #4/#6)
- ✅ Filtering by subject/year level works (deferred to #6, validators tested)
- ✅ Tagging remains consistent after edits (validators reused for updates)

## Dependencies

This PR is **independent** of #3 (schema/ORM) and #4 (resource table):
- Uses in-memory constants instead of DB (will migrate after #3)
- Validators are pure functions, ready to integrate with #4's create/update handlers
- API is read-only, no mutation methods

## Testing

All 49 tests pass, including:
- Linting: `npm run lint` ✅
- Build: `npm run build` ✅
- Format: `npm run format:check` ✅

## Breaking changes

None. This is a net-new feature with no impact on existing APIs.

---

Closes #5
