# Contract — issue-9: Require terms of use acceptance before first resource upload

> **This file is the interface lock.** Coder and tester must treat every signature,
> shape, and invariant here as ground truth. Do not deviate without updating this file
> first and informing both workers.

---

## Disambiguation log

| Ambiguity | Resolution | Source |
|---|---|---|
| Migration filename: `migrations/001_create_terms_acceptances.sql` vs `migrations/<timestamp>_create_terms_acceptances.sql` | **`migrations/001_create_terms_acceptances.sql`** — locked, literal filename. | plan.md is explicit (step 2, Files); impact.md's `<timestamp>` is illustrative only. |
| DB driver: raw `pg` vs an ORM (Prisma/Drizzle) | **`pg`** (node-postgres) — locked. Matches the raw-`.sql` migration file already specified and keeps the new dependency minimal, per plan.md's "minimal DB dependency" instruction. | impact.md lists both as options; plan.md step 1 says "minimal DB dependency". |
| Auth adapter signature: takes a `Request` param vs reads ambient request context | **No parameters** — `getCurrentTeacherId(): Promise<string \| null>`, reading identity via `next/headers()` internally. Locked so the exact same function works unmodified inside Route Handlers (`route.ts`) and Server Components (`page.tsx`), which do not both receive a `Request` object. | plan.md says only "current-user adapter", no signature; test-plan mocks it as "whatever minimal session-resolution function the routes/pages call" — resolved to a single zero-arg function. |
| Plan.md's third acceptance helper ("get latest acceptance") vs impact.md's public-API list (only `hasAcceptedCurrentTerms` + `recordAcceptance`) | **Locked as `getAcceptanceStatus(teacherId): Promise<AcceptanceStatus>`**, returning the exact `{ accepted, version?, acceptedAt? }` shape consumed directly by the `GET` route, the upload page, and the settings page — not a raw DB row. This resolves test-plan's ambiguous "hasAcceptedCurrentTerms-backing data ... return an acceptance row" wording for the GET-route "accepted" test. | plan.md step 2 ("get latest acceptance" helper); impact.md Public API surface section; test-plan GET-route and settings-page test descriptions. |
| `POST /api/terms-acceptance` with a non-current `version` in the body | **400** with body `{ "error": "invalid_terms_version" }`; `recordAcceptance` is **not** called. | test-plan: "response status 400 (or documented error status); recordAcceptance mock was not called". |
| `POST /api/upload` behavior once the terms gate passes (issue #4 unbuilt) | **501** with body `{ "error": "not_implemented" }` from a narrow `processUploadPlaceholder` boundary — satisfies "not 403" without inventing a fabricated upload-success contract that issue #4 would have to match or break. | plan.md step 4 ("narrow placeholder boundary"); test-plan explicitly avoids asserting a full success contract. |
| Unauthenticated request handling | **401** with body `{ "error": "unauthenticated" }` — locked for `GET`/`POST /api/terms-acceptance` (plan.md step 3: "reject unauthenticated access consistently") and extended identically to `POST /api/upload` for consistency (`hasAcceptedCurrentTerms(null)` is never called). | plan.md step 3 is explicit for the acceptance route; extended to upload route by the contract writer for consistency — not separately asserted by test-plan, see "NOT in contract" under Interface 6. |
| `TermsAcceptanceModal` acceptance submission: injected `onAccept` prop vs internal `fetch` call | **Internal `fetch("/api/terms-acceptance", ...)`** call inside the modal, plus an **optional** `onAccepted?: () => void` prop invoked after a successful (`2xx`) response. When `onAccepted` is omitted, the modal calls `router.refresh()` (`next/navigation`) as the default. This lets unit tests mock `global.fetch` and pass a spy `onAccepted`, while the real `upload/page.tsx` (a Server Component) can render the modal with zero function props (avoiding the Server→Client function-prop serialization problem). | test-plan: "the mocked submit call (`POST /api/terms-acceptance` **or equivalent prop callback**) ... on success the modal invokes its 'accepted'/close callback" — both readings are satisfied by this design. |
| Test tooling for the four new UI rendering tests (`TermsAcceptanceModal`, `upload/page`, `settings/page`, `terms/page`) | Test-plan asserts "no new test tooling needed", but rendering React components and querying the DOM requires `@testing-library/react` + a `jsdom` environment, neither of which exist in the repo (current `vitest.config.ts` sets `environment: "node"` globally, and no testing-library package is installed). **Locked:** add `@testing-library/react` and `jsdom` as devDependencies; each of the four new UI test files must open with the Vitest per-file pragma `// @vitest-environment jsdom` as its first line, leaving the global `node` environment and all other test files untouched. No `jest-dom` matcher package is added — assert on raw DOM properties (e.g. `element.hasAttribute("disabled")`) to keep the new-tooling footprint minimal. | Gap discovered by the contract writer; required to make test-plan's own listed behaviors (Interface 8–11) executable. See Interface 12. |

---

## Interface 1 — `src/lib/terms.ts`

### Path
`src/lib/terms.ts`

### Exports
```typescript
export const CURRENT_TERMS_VERSION: string; // e.g. "2026-08-01" — non-empty string literal
export const TERMS_TEXT: string;            // full terms-of-use body, non-empty
```

### Semantics
- **Pre-conditions:** None. Pure constants module, no I/O.
- **Post-conditions:**
  - `CURRENT_TERMS_VERSION` is a non-empty `string` used as the single comparable version
    identifier everywhere else in the codebase (acceptance helpers, upload gate, UI).
  - `TERMS_TEXT` is a non-empty `string` containing the full terms-of-use content, rendered
    verbatim by `src/app/terms/page.tsx` and referenced (not necessarily rendered in full)
    by `TermsAcceptanceModal`.
- **Invariants:**
  - Bumping `CURRENT_TERMS_VERSION` is the **only** required code change to re-engage the
    upload block for every previously-accepted teacher (per impact.md).

### Signature details
```typescript
export const CURRENT_TERMS_VERSION = "2026-08-01";

export const TERMS_TEXT = `Teacher Hub — Terms of Use
...`;
```
> Exact version string and legal prose are coder discretion; the shape (two non-empty
> string exports, no functions, no default export) is locked.

### Errors
- None; purely declarative.

### Side effects
- None.

### NOT in contract
- Legal wording/content of `TERMS_TEXT`.
- Whether `CURRENT_TERMS_VERSION` is a date-like string, semver, or incrementing integer —
  any non-empty string is acceptable as long as it is stable and comparable with `===`.

---

## Interface 2 — `src/lib/db.ts`

### Path
`src/lib/db.ts`

### Exports
```typescript
export interface QueryResult<T> {
  rows: T[];
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>>;
```

### Semantics
- **Pre-conditions:** `process.env.DATABASE_URL` is set in real (non-test) environments.
  In tests, this module is always mocked (`vi.mock("@/lib/db")`) — no live Postgres
  connection is ever required to pass the suite.
- **Post-conditions:** `query(text, params)` executes a parameterized SQL statement
  against a lazily-created connection pool and resolves with `{ rows: T[] }`, mirroring
  `pg`'s `Pool.query` result shape so callers can destructure `{ rows }` directly.
- **Invariants:**
  - The pool/connection is created lazily (on first `query` call), not at module import
    time, so importing `src/lib/db.ts` never throws in test environments lacking
    `DATABASE_URL`.

### Signature details
```typescript
import { Pool } from "pg";

export interface QueryResult<T> {
  rows: T[];
}

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const result = await getPool().query(text, params);
  return { rows: result.rows as T[] };
}
```
> **Import rule:** Consumers (`src/lib/terms-acceptance.ts`) must `import { query } from
> "@/lib/db"` — not instantiate their own `pg.Pool`. This is the only file that touches
> `pg` directly.

### Errors
- Propagates any error thrown by the underlying `pg` driver (connection failure, syntax
  error, constraint violation) unchanged — `src/lib/terms-acceptance.ts` is responsible
  for interpreting driver-specific error shapes (e.g. unique-violation code `23505`).

### Side effects
- Opens/reuses a PostgreSQL connection pool. No other side effects.

### NOT in contract
- Pool sizing, timeout, or SSL configuration options.
- A `close()`/teardown export (not required by any listed test).

---

## Interface 3 — `src/lib/auth.ts`

### Path
`src/lib/auth.ts`

### Exports
```typescript
export async function getCurrentTeacherId(): Promise<string | null>;
```

### Semantics
- **Pre-conditions:** Must be callable both from Route Handlers (`route.ts`) and from
  Server Components (`page.tsx`) with an identical signature — **no parameters**.
- **Post-conditions:** Resolves to the authenticated teacher's stable identifier
  (`string`), or `null` if no session/identity can be resolved.
- **Invariants:**
  - This is a narrow placeholder adapter. It must not hard-code a real auth provider,
    JWT verification, or database session lookup — issue #2 replaces the internals.
    Callers only ever depend on the `Promise<string | null>` contract.

### Signature details
```typescript
export async function getCurrentTeacherId(): Promise<string | null> {
  // Placeholder: real session/identity resolution arrives with issue #2.
  // Must not throw; return null when identity cannot be resolved.
  return null;
}
```
> Coder may read `next/headers()`/`cookies()` internally once a real mechanism exists;
> for this ticket a stub returning `null` (or a fixed dev value gated behind a clearly
> temporary code path) is acceptable, since all consumers are exercised via
> `vi.mock("@/lib/auth")` in tests.

### Errors
- Must not throw. Callers treat `null` as "unauthenticated"; they do not catch errors
  from this function.

### Side effects
- None (or read-only access to request headers/cookies once implemented for real).

### NOT in contract
- Real session/token verification logic (issue #2).
- Any parameter accepting a `Request` — forbidden, see Disambiguation log.

---

## Interface 4 — `src/lib/terms-acceptance.ts`

### Path
`src/lib/terms-acceptance.ts`

### Exports
```typescript
export interface AcceptanceStatus {
  accepted: boolean;
  version?: string;
  acceptedAt?: string; // ISO 8601 timestamp
}

export async function hasAcceptedCurrentTerms(teacherId: string): Promise<boolean>;

export async function getAcceptanceStatus(teacherId: string): Promise<AcceptanceStatus>;

export async function recordAcceptance(
  teacherId: string,
  version: string,
): Promise<{ acceptedAt: string }>;
```

### Semantics
- **Pre-conditions:** `teacherId` is a non-empty string. Callers resolve it via
  `getCurrentTeacherId()` before calling any function here; this module never resolves
  identity itself.
- **Post-conditions:**
  - `hasAcceptedCurrentTerms(teacherId)` resolves `true` **iff** the teacher's most
    recent acceptance row has `terms_version === CURRENT_TERMS_VERSION`; `false` if no
    row exists, or the most recent row is for an older version.
  - `getAcceptanceStatus(teacherId)` resolves:
    - `{ accepted: false }` (no `version`/`acceptedAt` keys present in the returned
      object) when no row exists, or the latest row's version does not match
      `CURRENT_TERMS_VERSION`.
    - `{ accepted: true, version: CURRENT_TERMS_VERSION, acceptedAt: <ISO string> }`
      when the latest row's version matches `CURRENT_TERMS_VERSION`.
  - `recordAcceptance(teacherId, version)` inserts an append-only row
    `(teacher_id, terms_version, accepted_at)` and resolves `{ acceptedAt: <ISO string> }`
    reflecting the row's `accepted_at`.
  - `recordAcceptance` is **idempotent under the unique constraint**: if the underlying
    `query()` call rejects with a PostgreSQL unique-violation (`error.code === "23505"`)
    because `(teacher_id, terms_version)` already exists (concurrent first-upload race),
    `recordAcceptance` catches it and resolves `{ acceptedAt: <ISO string> }` rather than
    rethrowing. It never surfaces the race as a thrown error.
- **Invariants:**
  - No function in this module ever performs an `UPDATE`/`DELETE` against
    `terms_acceptances` — the table is append-only.
  - `hasAcceptedCurrentTerms` and `getAcceptanceStatus` are read-only.

### Signature details
```typescript
import { query } from "@/lib/db";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

interface AcceptanceRow {
  terms_version: string;
  accepted_at: string;
}

export interface AcceptanceStatus {
  accepted: boolean;
  version?: string;
  acceptedAt?: string;
}

async function latestAcceptanceRow(teacherId: string): Promise<AcceptanceRow | null> {
  const { rows } = await query<AcceptanceRow>(
    `SELECT terms_version, accepted_at FROM terms_acceptances
     WHERE teacher_id = $1
     ORDER BY accepted_at DESC
     LIMIT 1`,
    [teacherId],
  );
  return rows[0] ?? null;
}

export async function hasAcceptedCurrentTerms(teacherId: string): Promise<boolean> {
  const row = await latestAcceptanceRow(teacherId);
  return row?.terms_version === CURRENT_TERMS_VERSION;
}

export async function getAcceptanceStatus(teacherId: string): Promise<AcceptanceStatus> {
  const row = await latestAcceptanceRow(teacherId);
  if (row?.terms_version === CURRENT_TERMS_VERSION) {
    return { accepted: true, version: row.terms_version, acceptedAt: row.accepted_at };
  }
  return { accepted: false };
}

export async function recordAcceptance(
  teacherId: string,
  version: string,
): Promise<{ acceptedAt: string }> {
  try {
    const { rows } = await query<{ accepted_at: string }>(
      `INSERT INTO terms_acceptances (teacher_id, terms_version)
       VALUES ($1, $2)
       RETURNING accepted_at`,
      [teacherId, version],
    );
    return { acceptedAt: rows[0].accepted_at };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      // Unique-violation: another concurrent request already recorded this
      // (teacherId, version) pair. Treat as an idempotent success.
      return { acceptedAt: new Date().toISOString() };
    }
    throw error;
  }
}
```

### Errors
- `recordAcceptance` re-throws any error whose `.code !== "23505"` (e.g. connection
  failure) — callers (`route.ts`) do not need to special-case this; an uncaught rejection
  in a Route Handler surfaces as a 500 by Next.js default behavior, which is acceptable
  and untested here.

### Side effects
- Reads/writes the `terms_acceptances` table via `src/lib/db.ts`.

### NOT in contract
- Any caching/memoization of acceptance status.
- Exact SQL text — the queries above are illustrative; the *shape* of each function
  (parameters, return type, idempotent-insert behavior) is what's locked.

---

## Interface 5 — `src/app/api/terms-acceptance/route.ts`

### Path
`src/app/api/terms-acceptance/route.ts`

### Exports
```typescript
export async function GET(request: Request): Promise<Response>;
export async function POST(request: Request): Promise<Response>;
```

### Semantics
- **`GET`:**
  - Resolves `teacherId` via `getCurrentTeacherId()`.
  - If `teacherId === null` → `401` with body `{ "error": "unauthenticated" }`.
  - Otherwise → `200` with body `getAcceptanceStatus(teacherId)` (either
    `{ accepted: false }` or `{ accepted: true, version, acceptedAt }`, see Interface 4).
- **`POST`:**
  - Resolves `teacherId` via `getCurrentTeacherId()`.
  - If `teacherId === null` → `401` with body `{ "error": "unauthenticated" }`.
  - Parses the JSON request body as `{ version: string }`.
  - If `body.version !== CURRENT_TERMS_VERSION` → `400` with body
    `{ "error": "invalid_terms_version" }`; `recordAcceptance` is **not** called.
  - Otherwise calls `recordAcceptance(teacherId, body.version)` and responds `201` with
    body `{ acceptedAt: <ISO string> }` (from the helper's return value).

### Signature details
```typescript
import { NextResponse } from "next/server";
import { getCurrentTeacherId } from "@/lib/auth";
import { getAcceptanceStatus, recordAcceptance } from "@/lib/terms-acceptance";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export async function GET(_request: Request): Promise<Response> {
  const teacherId = await getCurrentTeacherId();
  if (teacherId === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const status = await getAcceptanceStatus(teacherId);
  return NextResponse.json(status, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  const teacherId = await getCurrentTeacherId();
  if (teacherId === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const body = (await request.json()) as { version?: string };
  if (body.version !== CURRENT_TERMS_VERSION) {
    return NextResponse.json({ error: "invalid_terms_version" }, { status: 400 });
  }
  const { acceptedAt } = await recordAcceptance(teacherId, body.version);
  return NextResponse.json({ acceptedAt }, { status: 201 });
}
```
> **Import rule:** Use `NextResponse` from `"next/server"` for every response, consistent
> with `src/app/api/health/route.ts`. Do not construct raw `Response` objects.

### Errors
- No declared thrown errors; `401`/`400` are returned as responses, not thrown.

### Side effects
- `GET` is read-only. `POST` writes one row via `recordAcceptance`.

### NOT in contract
- Rate limiting, request logging.
- Any response field beyond `error` / `accepted` / `version` / `acceptedAt`.

---

## Interface 6 — `src/app/api/upload/route.ts`

### Path
`src/app/api/upload/route.ts`

### Exports
```typescript
export async function POST(request: Request): Promise<Response>;
```

### Semantics
- Resolves `teacherId` via `getCurrentTeacherId()`.
- If `teacherId === null` → `401` with body `{ "error": "unauthenticated" }`.
- Calls `hasAcceptedCurrentTerms(teacherId)`.
  - If `false` → `403` with body `{ "error": "terms_not_accepted" }`. No upload
    processing occurs (the placeholder below must not run).
  - If `true` → delegates to a narrow placeholder boundary that returns `501` with body
    `{ "error": "not_implemented" }` (issue #4 replaces this body with real upload
    handling; the terms gate above it does not change).
- **Invariant:** the terms-gate check always runs **before** any placeholder/upload
  logic, and is not bypassable by request shape (query params, headers, etc.).

### Signature details
```typescript
import { NextResponse } from "next/server";
import { getCurrentTeacherId } from "@/lib/auth";
import { hasAcceptedCurrentTerms } from "@/lib/terms-acceptance";

async function processUploadPlaceholder(_request: Request): Promise<Response> {
  // Real file-handling logic arrives with issue #4. This boundary exists so the
  // terms gate above it is untouched when that lands.
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}

export async function POST(request: Request): Promise<Response> {
  const teacherId = await getCurrentTeacherId();
  if (teacherId === null) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const accepted = await hasAcceptedCurrentTerms(teacherId);
  if (!accepted) {
    return NextResponse.json({ error: "terms_not_accepted" }, { status: 403 });
  }
  return processUploadPlaceholder(request);
}
```

### Errors
- No declared thrown errors under normal operation.

### Side effects
- Read-only against `terms_acceptances` (via `hasAcceptedCurrentTerms`). No upload side
  effects exist yet (issue #4).

### NOT in contract
- The `401` unauthenticated path for this route is **not directly asserted** by any
  test-plan.md behavior (only the `403`/pass-through cases are tested); it is included
  for consistency with Interface 5 and must not conflict with the two tested cases.
- Real file storage, validation, or processing (issue #4).
- The exact response shape of `processUploadPlaceholder` beyond "not `403`" — `501` +
  `{ error: "not_implemented" }` is the locked value, but tests only assert the response
  is not the terms-blocked shape.

---

## Interface 7 — `src/app/terms/page.tsx`

### Path
`src/app/terms/page.tsx`

### Exports
```typescript
export default function TermsPage(): JSX.Element;
```

### Semantics
- Pure, synchronous Server Component (no `async`, no data fetching) — renders
  `TERMS_TEXT` and `CURRENT_TERMS_VERSION` from `src/lib/terms.ts` directly.
- Rendered output must contain a recognizable substring of `TERMS_TEXT` and the literal
  `CURRENT_TERMS_VERSION` string somewhere in the DOM.

### Signature details
```tsx
import { CURRENT_TERMS_VERSION, TERMS_TEXT } from "@/lib/terms";

export default function TermsPage() {
  return (
    <main>
      <h1>Terms of Use</h1>
      <p>Version: {CURRENT_TERMS_VERSION}</p>
      <article>{TERMS_TEXT}</article>
    </main>
  );
}
```

### Errors
- None; no I/O.

### Side effects
- None.

### NOT in contract
- Styling, layout beyond containing the two required text values.

---

## Interface 8 — `src/components/TermsAcceptanceModal.tsx`

### Path
`src/components/TermsAcceptanceModal.tsx`

### Exports
```typescript
export interface TermsAcceptanceModalProps {
  termsVersion: string;
  termsText: string;
  onAccepted?: () => void;
}

export default function TermsAcceptanceModal(
  props: TermsAcceptanceModalProps,
): JSX.Element;
```

### Semantics
- **`"use client"`** component.
- Renders `termsText` (or a scrollable excerpt), a link to the full terms page with
  `href="/terms"`, an accessible checkbox (has an associated `<label>` or
  `aria-label`), and a submit button.
- The submit button has the `disabled` attribute set **until** the checkbox is checked;
  once checked, `disabled` is removed.
- On submit click, calls:
  ```typescript
  fetch("/api/terms-acceptance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: termsVersion }),
  })
  ```
  exactly once per submit, with `version` equal to the `termsVersion` prop.
- If the response is ok (`2xx`):
  - If `props.onAccepted` is provided, calls it (no arguments).
  - If `props.onAccepted` is **not** provided, calls `router.refresh()` using
    `useRouter()` from `next/navigation` as the default post-accept behavior.
- **Invariant:** the component never calls `fetch` before the checkbox is checked and
  submit is clicked (no auto-submit).

### Signature details
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface TermsAcceptanceModalProps {
  termsVersion: string;
  termsText: string;
  onAccepted?: () => void;
}

export default function TermsAcceptanceModal({
  termsVersion,
  termsText,
  onAccepted,
}: TermsAcceptanceModalProps) {
  const [checked, setChecked] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    const response = await fetch("/api/terms-acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: termsVersion }),
    });
    if (response.ok) {
      if (onAccepted) {
        onAccepted();
      } else {
        router.refresh();
      }
    }
  }

  return (
    <div role="dialog" aria-modal="true">
      <p>{termsText}</p>
      <a href="/terms">Read the full terms of use</a>
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        I have read and accept the current terms of use
      </label>
      <button type="button" disabled={!checked} onClick={handleSubmit}>
        Accept and continue
      </button>
    </div>
  );
}
```
> **Import rule:** `useRouter` must come from `"next/navigation"` (App Router), not
> `"next/router"` (Pages Router) — the latter throws when invoked outside a Pages Router
> tree.

### Errors
- Does not throw on a failed `fetch`; a non-`ok` response simply leaves the modal open
  (no `onAccepted`/`router.refresh()` call). Network-level rejection handling beyond
  "don't call the success callbacks" is not asserted by tests.

### Side effects
- One `POST /api/terms-acceptance` network call per submit click.
- `router.refresh()` (only when `onAccepted` is omitted).

### NOT in contract
- Exact visual styling, modal-vs-inline layout, animation.
- Loading/spinner state during the in-flight fetch.
- Error message rendering on a failed submit.

---

## Interface 9 — `src/app/upload/page.tsx`

### Path
`src/app/upload/page.tsx`

### Exports
```typescript
export default async function UploadPage(): Promise<JSX.Element>;
```

### Semantics
- `async` Server Component.
- Resolves `teacherId` via `getCurrentTeacherId()` and status via
  `getAcceptanceStatus(teacherId)` (both called server-side; no client `fetch`).
- If `status.accepted === false` → renders `<TermsAcceptanceModal termsVersion={CURRENT_TERMS_VERSION} termsText={TERMS_TEXT} />` and does **not** render the upload form controls.
- If `status.accepted === true` → renders the upload form (any placeholder markup) and
  does **not** render `TermsAcceptanceModal`.

### Signature details
```tsx
import { getCurrentTeacherId } from "@/lib/auth";
import { getAcceptanceStatus } from "@/lib/terms-acceptance";
import { CURRENT_TERMS_VERSION, TERMS_TEXT } from "@/lib/terms";
import TermsAcceptanceModal from "@/components/TermsAcceptanceModal";

export default async function UploadPage() {
  const teacherId = await getCurrentTeacherId();
  const status = teacherId ? await getAcceptanceStatus(teacherId) : { accepted: false };

  if (!status.accepted) {
    return (
      <main>
        <TermsAcceptanceModal termsVersion={CURRENT_TERMS_VERSION} termsText={TERMS_TEXT} />
      </main>
    );
  }

  return (
    <main>
      <h1>Upload a resource</h1>
      {/* upload form placeholder — real fields arrive with issue #4 */}
    </main>
  );
}
```

### Errors
- None declared.

### Side effects
- Read-only (`getAcceptanceStatus`).

### NOT in contract
- Any upload form field, validation, or submission logic (issue #4).
- Exact DOM structure beyond "modal present XOR upload-form marker present".

---

## Interface 10 — `src/app/settings/page.tsx`

### Path
`src/app/settings/page.tsx`

### Exports
```typescript
export default async function SettingsPage(): Promise<JSX.Element>;
```

### Semantics
- `async` Server Component.
- Resolves `teacherId` via `getCurrentTeacherId()` and status via
  `getAcceptanceStatus(teacherId)`.
- If `status.accepted === true` → rendered output contains `status.version` and a
  human-readable rendering of `status.acceptedAt` (e.g. via
  `new Date(status.acceptedAt).toLocaleString()` or equivalent; the raw ISO string is
  also an acceptable "human-readable" rendering for test purposes since the test only
  checks the rendered output contains the version and timestamp values).
- If `status.accepted === false` → rendered output contains a clear "not yet accepted" /
  stale-status message (no version/timestamp values to show).

### Signature details
```tsx
import { getCurrentTeacherId } from "@/lib/auth";
import { getAcceptanceStatus } from "@/lib/terms-acceptance";

export default async function SettingsPage() {
  const teacherId = await getCurrentTeacherId();
  const status = teacherId ? await getAcceptanceStatus(teacherId) : { accepted: false };

  return (
    <main>
      <h1>Account settings</h1>
      <section>
        <h2>Terms of use</h2>
        {status.accepted ? (
          <p>
            Accepted version {status.version} on{" "}
            {new Date(status.acceptedAt as string).toLocaleString()}
          </p>
        ) : (
          <p>You have not yet accepted the current terms of use.</p>
        )}
      </section>
    </main>
  );
}
```

### Errors
- None declared.

### Side effects
- Read-only.

### NOT in contract
- Any other settings-page content (profile, preferences) — this ticket only requires
  the terms-acceptance section.
- Exact date formatting.

---

## Interface 11 — `migrations/001_create_terms_acceptances.sql`

### Path
`migrations/001_create_terms_acceptances.sql`

### Required shape
```sql
CREATE TABLE terms_acceptances (
    id SERIAL PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    terms_version TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (teacher_id, terms_version)
);
```

### Semantics
- Table name is exactly `terms_acceptances`; column names are exactly `id`,
  `teacher_id`, `terms_version`, `accepted_at`.
- `UNIQUE (teacher_id, terms_version)` is mandatory — it is the mechanism
  `recordAcceptance` (Interface 4) relies on to detect and absorb concurrent
  first-upload races via Postgres error code `23505`.
- No `UPDATE`/`DELETE` statements or triggers — append-only by application convention,
  not a DB-level constraint.

### NOT in contract
- Additional indexes beyond the unique constraint.
- Migration tooling/runner (none is introduced by this ticket; the file is raw SQL for a
  human/CI step to apply per impact.md's rollout note).

---

## Interface 12 — Test tooling & environment additions

### Path
`package.json` (devDependencies), and a `// @vitest-environment jsdom` pragma line in
four specific test files.

### Required devDependency additions
```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "jsdom": "^25.0.0",
    "pg": "^8.13.0",
    "@types/pg": "^8.11.0"
  }
}
```
> `pg` is listed here for completeness but is a **runtime** dependency
> (`dependencies`, not `devDependencies`) — see Interface 13. `@types/pg` is
> dev-only. Exact version ranges are illustrative; any mutually-compatible versions
> satisfying peer requirements (React 19, Node 20) are acceptable.

### Required per-file pragma (first line of each file, before any `import`)
```typescript
// @vitest-environment jsdom
```
Required in exactly these four new test files (and no others):
- `src/components/__tests__/TermsAcceptanceModal.test.tsx`
- `src/app/upload/__tests__/page.test.tsx`
- `src/app/settings/__tests__/page.test.tsx`
- `src/app/terms/__tests__/page.test.tsx`

### Semantics
- `vitest.config.ts`'s global `test.environment: "node"` is **not** changed — every
  existing test file (route handlers, `__tests__` file-assertion suites) keeps running
  under `node`.
- The four files above opt into `jsdom` individually via the pragma so
  `@testing-library/react`'s `render()` has a DOM to mount into.
- Async Server Components (`UploadPage`, `SettingsPage`) are tested by calling and
  `await`-ing the exported function directly to obtain a `JSX.Element`, then passing
  that resolved element to `render()` — e.g. `render(await UploadPage())` — since
  `render()` itself does not await async components.
- `vi.mock("@/lib/auth")` / `vi.mock("@/lib/terms-acceptance")` factories must be
  declared with `vi.mock(...)` called directly at the top level of each test file (after
  imports); do not wrap `vi.mock` calls inside a helper function in another module —
  Vitest's static hoisting only hoists `vi.mock` calls that are lexically present in the
  test file itself.

### NOT in contract
- `@testing-library/jest-dom` custom matchers — not added; assertions use plain DOM
  properties/attributes instead (e.g. `.hasAttribute("disabled")` rather than
  `.toBeDisabled()`).
- A shared Vitest `setupFiles` entry — not required since no global matcher extension is
  added.

---

## Interface 13 — `package.json` (runtime dependency) and `.env.example` / `README.md`

### Path
`package.json`, `.env.example`, `README.md`

### Required `package.json` runtime dependency
```json
{
  "dependencies": {
    "pg": "^8.13.0"
  }
}
```

### Required `.env.example` change
The existing commented-out line:
```
# DATABASE_URL=******localhost:5432/teacher_hub
```
must become an **active, uncommented** entry (still a placeholder, no real secret):
```
DATABASE_URL=******localhost:5432/teacher_hub
```
This keeps `env-config.test.ts`'s three assertions passing (`/^[A-Z_]+=.*/m` already
matches `APP_ENV=`, so this is an additive requirement from plan.md/impact.md, not a
test-breaking one) while satisfying plan.md step 7's instruction to document
`DATABASE_URL` as a real requirement rather than a future placeholder comment.

### Required `README.md` content (minimum, wording free)
| Topic | Minimum content |
|---|---|
| Env var | Documents `DATABASE_URL` as a required environment variable for this ticket's DB-backed features. |
| Routes | Mentions the `/terms`, `/upload`, and `/settings` routes and their purpose. |
| Version-bump behavior | States that bumping the terms version re-requires acceptance on the next upload. |

### NOT in contract
- Exact prose, heading names, or section ordering — `readme.test.ts` is unmodified and
  already passes on the existing README; the table above is an additive documentation
  requirement from plan.md step 7, not a new automated assertion.

---

## Acceptance criterion traceability

| Criterion (ticket.md) | Interfaces |
|---|---|
| Terms text stored with an explicit, comparable version | 1, 7 |
| Teacher without acceptance is blocked on first upload, presented with terms + affirmative control | 6, 8, 9 |
| Server-side upload path rejects unaccepted teachers, unbypassable via UI | 4, 6 |
| Acceptance records teacher identity, version, and timestamp | 4, 5, 11 |
| Already-accepted teacher is not re-prompted | 4, 6, 9 |
| Teacher can view accepted version + timestamp in settings | 4, 5, 10 |
| Terms reachable as a linkable readable page | 7, 8 |
| Version bump forces re-acceptance before next upload (resolved: forced re-acceptance) | 4, 6, 9 |
| Concurrent first-upload race does not create duplicate/conflicting records | 4, 11 |
