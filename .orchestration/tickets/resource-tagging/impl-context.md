# Implementation context (shared A/B brief)

This brief is for both the **coder** and the **tester**. It is discovery output —
not a prescription. Read it before writing any code so you do not re-invent
conventions that already exist in the repo.

---

## Files this touches

### Create (new files)
| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Prisma datasource/generator + `Resource`, `Tag`, `ResourceTag` models |
| `prisma/migrations/0001_init/migration.sql` | Initial DDL (3 tables, unique indexes, cascade FKs) |
| `prisma/migrations/migration_lock.toml` | Migration lock (provider = sqlite) |
| `src/lib/prisma.ts` | Singleton `PrismaClient` (global pattern for Next.js hot-reload safety) |
| `src/lib/slug.ts` | `toSlug(name: string): string` utility |
| `src/app/api/tags/route.ts` | `GET` + `POST /api/tags` |
| `src/app/api/tags/[id]/route.ts` | `DELETE /api/tags/[id]` |
| `src/app/api/resources/route.ts` | `GET` + `POST /api/resources` |
| `src/app/api/resources/[id]/tags/route.ts` | `POST` + `DELETE /api/resources/[id]/tags` |
| `src/app/api/tags/__tests__/route.test.ts` | Vitest tests for tag list/create |
| `src/app/api/tags/[id]/__tests__/route.test.ts` | Vitest tests for tag delete |
| `src/app/api/resources/__tests__/route.test.ts` | Vitest tests for resource list/filter/create |
| `src/app/api/resources/[id]/tags/__tests__/route.test.ts` | Vitest tests for attach/detach |
| `src/lib/__tests__/slug.test.ts` | Unit tests for `toSlug` |

### Modify (existing files)
| File | Change |
|---|---|
| `package.json` | Add `@prisma/client` dep, `prisma` devDep, `db:generate`/`db:migrate`/`db:migrate:deploy` scripts, `postinstall: prisma generate` |
| `.env.example` | Add `DATABASE_URL=file:./prisma/dev.db` with PostgreSQL swap comment |
| `.gitignore` | Add `prisma/dev.db`, `prisma/dev.db-journal`, `prisma/*.db` |
| `README.md` | Add "Database" section (setup, migrate, generate) |

### Do not touch
| File | Reason |
|---|---|
| `src/app/api/health/route.ts` | No Prisma; intentionally database-free |
| `src/app/api/health/__tests__/route.test.ts` | Already passes; no Prisma mock needed |
| `src/lib/health.ts` | Unrelated |

---

## Patterns to follow

### Next.js App Router route handler convention

Reference: `src/app/api/health/route.ts`

```ts
import { NextResponse } from "next/server";

// Static route (no URL params)
export async function GET(request: Request): Promise<Response> {
  return NextResponse.json(payload, { status: 200 });
}

// Dynamic route (URL params) — Next.js 15: params is a Promise
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  // ...
}
```

Key points:
- Return type is `Promise<Response>` (not `NextResponse` — `NextResponse` extends `Response`).
- Use `NextResponse.json(body, { status })` for all JSON responses.
- Parse `request.headers.get("X-Teacher-Id")` for auth.
- Parse `new URL(request.url).searchParams` for query params.
- Parse `await request.json()` for request bodies (wrap in try/catch for malformed JSON).
- In Next.js 15, `context.params` is a `Promise`; always `await` it in dynamic routes.

### Prisma singleton (Next.js hot-reload safe)

```ts
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

### Slug utility skeleton

```ts
// src/lib/slug.ts
export function toSlug(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new TypeError("Tag name must not be empty");
  return trimmed
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")   // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")       // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, "");          // strip leading/trailing hyphens
}
```

(Coder may refine Unicode handling; the above is the reference pattern, not a mandate.)

### Vitest test convention

Reference: `src/app/api/health/__tests__/route.test.ts`

- **Test file location:** co-located under `__tests__/` next to the module under test.
- **Test runner:** Vitest with `globals: true` (no need to import `describe`/`it`/`expect`).
- **Import style:** `import { GET } from "@/app/api/tags/route"` (path alias `@/` = `src/`).
- **Invocation:** call the exported handler directly with `new Request(url, options)`.
- **Prisma mock:**

```ts
vi.mock("@/lib/prisma", () => ({
  default: {
    tag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    resource: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    resourceTag: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
```

- Use `mockResolvedValue` to stub return values per test.
- Reset mocks in `beforeEach` via `vi.resetAllMocks()` or per-test setup.
- Assert `response.status` and `await response.json()`.

**Request helper (copy into each test file):**
```ts
const makeRequest = (
  url: string,
  method: string,
  teacherId: string | null,
  body?: object
) =>
  new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(teacherId ? { "X-Teacher-Id": teacherId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
```

**Test fixtures:**
```ts
const tagFixture = {
  id: "tag-1",
  name: "AQA GCSE",
  slug: "aqa-gcse",
  teacherId: "t1",
  createdAt: new Date(),
};

const resourceFixture = {
  id: "res-1",
  title: "My Worksheet",
  teacherId: "t1",
  createdAt: new Date(),
};

const resourceTagFixture = { resourceId: "res-1", tagId: "tag-1" };

const otherTeacherTag = {
  id: "tag-2",
  name: "Another Tag",
  slug: "another-tag",
  teacherId: "t2",
  createdAt: new Date(),
};
```

---

## Utilities to reuse

| Utility | Location | Use for |
|---|---|---|
| `NextResponse.json` | `next/server` | All JSON responses in route handlers |
| `toSlug` | `src/lib/slug.ts` | Slug generation in `POST /api/tags` |
| `prisma` (default) | `src/lib/prisma.ts` | All DB operations in route handlers |

---

## Anti-patterns in this codebase

1. **Do not import `PrismaClient` directly in route handlers** — always import the
   singleton from `src/lib/prisma.ts`. Importing `PrismaClient` directly in multiple
   modules creates multiple connection pools (Next.js hot-reload issue).

2. **Do not use `Response.json(...)` (Web API)** — use `NextResponse.json(...)` from
   `next/server` to stay consistent with the health route convention and ensure
   correct content-type headers.

3. **Do not silently return 404 for authorization failures** — if a resource/tag exists
   but belongs to another teacher, return `403` with an explicit error body. Silent 404
   is forbidden by contract (AC-5).

4. **Do not catch Prisma unique-constraint errors with a generic 500** — the slug
   collision scenario (`P2002` Prisma error code for unique constraint) must be caught
   and returned as `409`.

5. **Do not access `context.params` synchronously** — in Next.js 15, `params` is a
   Promise. Always `const { id } = await context.params`.

6. **Do not widen results for unknown slugs** — an unrecognised slug in `?tags=`
   contributes zero matches (OR: ignored; AND: forces empty set). Never 404 on unknown
   slugs in filter params.

---

## Repo commands (verified)

```bash
# Run all tests
npm test
# equivalent: npx vitest run

# Run only the new feature tests (once files exist)
npx vitest run src/app/api/tags src/app/api/resources src/lib

# TypeScript type-check (no emit)
npx tsc --noEmit

# Lint
npm run lint

# Build (requires DATABASE_URL + generated Prisma client)
npm run build

# Generate Prisma client (after schema changes or fresh clone)
npx prisma generate
# or (after adding postinstall script): npm install

# Apply migrations locally
npx prisma migrate dev

# Apply migrations in CI/production
npx prisma migrate deploy
```

**Note:** `npm test`, `tsc --noEmit`, and `npm run build` will fail in a clean checkout
until `npx prisma generate` has been run. The `postinstall` script in `package.json`
automates this after `npm install`.
