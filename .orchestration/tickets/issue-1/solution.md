# Solution: Next.js Scaffolding Foundation with TypeScript and App Router

## Direction

Create a greenfield Next.js application using modern conventions: TypeScript, App Router, and a clear folder hierarchy separating UI (React components), API routes, and shared utilities. The application will export a simple health-check endpoint (`GET /api/health`) that responds with a 200 status and a JSON body, proving the app boots and routes requests correctly.

Environment configuration will follow the `.env.local` / `.env.example` pattern: developers copy `.env.example` to `.env.local` and populate secrets locally; `.env.local` is gitignored so secrets are never committed. This unblocks downstream auth (#2) and database (#3) issues to wire their own environment variables into the same system.

Linting and formatting will be configured in `package.json` scripts (`npm run lint`, `npm run format`), powered by ESLint and Prettier, and run successfully against the scaffolded code. A CI-ready build and test script (`npm run build`, `npm test`) will exist and pass, including at least one trivial but real test case so the CI "test" step is meaningful.

## Key decisions

- **TypeScript:** provides early error detection and benefits multi-issue MVP consistency.
- **App Router (not Pages Router):** modern Next.js default; cleaner API route conventions.
- **Folder structure:** `src/app/` for UI/layout, `src/app/api/` for API routes, `src/lib/` for shared utilities. Clear and familiar.
- **Health-check endpoint:** minimal viable proof of routing — no database dependency, can return success before #3 lands.
- **npm + LTS Node.js:** lowest friction for MVP team; version pinned so CI and local match.
- **ESLint + Prettier:** standard ecosystem tooling; familiar to most developers.
- **One passing test:** ensures CI test step is not a no-op; establishes the test runner pattern for downstream issues.

## Explicitly rejected

- **Pages Router:** older Next.js paradigm; App Router is now the standard and better aligns with the project's cleaner API route needs.
- **Plain JavaScript:** TypeScript's type safety and IDE support are worth the build step complexity.
- **Complex examples:** foundation should be minimal; downstream features (#2–#8) will populate real code.
- **Git hooks (Husky, etc.):** nice-to-have but out of scope; linting is dev-initiated for now.

## Open questions

- None — all acceptance criteria and assumptions have been resolved. Ready to plan and implement.
