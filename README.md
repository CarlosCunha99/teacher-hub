# Teacher Hub

A platform for teachers to share and discover classroom resources. This repository
contains the foundational Next.js application skeleton that all downstream MVP features
(authentication, data model, uploads, search, boards, profiles) build on.

## Tech stack

- **[Next.js](https://nextjs.org/)** (App Router) — React framework with file-based routing and colocated API route handlers.
- **[React](https://react.dev/)** — UI library.
- **[TypeScript](https://www.typescriptlang.org/)** — static typing in `strict` mode.
- **[ESLint](https://eslint.org/)** + **[Prettier](https://prettier.io/)** — linting and formatting.
- **[Vitest](https://vitest.dev/)** — test runner.
- **Node.js 20 LTS** — pinned via `.nvmrc` and enforced through `engines`.

## Prerequisites

- **Node.js 20.x** (the version pinned in [`.nvmrc`](./.nvmrc)). If you use `nvm`, run
  `nvm use`; if you use `fnm`, run `fnm use`.
- **npm** (bundled with Node.js).

## Getting started

```bash
# 1. Clone the repository
git clone https://github.com/CarlosCunha99/teacher-hub.git
cd teacher-hub

# 2. Use the pinned Node version
nvm use            # or: fnm use

# 3. Copy the environment template and fill in values as needed
cp .env.example .env.local

# 4. Install dependencies
npm install

# 5. Start the development server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000). The health-check endpoint
is available at [http://localhost:3000/api/health](http://localhost:3000/api/health) and
returns `{ "status": "ok" }` with HTTP 200.

## Available scripts

These scripts run identically locally and in CI (install → lint → test → build):

| Script                 | Command              | Description                                   |
| ---------------------- | -------------------- | --------------------------------------------- |
| `npm run dev`          | `next dev`           | Start the development server with hot reload. |
| `npm run build`        | `next build`         | Produce a production build in `.next/`.       |
| `npm start`            | `next start`         | Serve the production build.                   |
| `npm run lint`         | `next lint`          | Run ESLint over the codebase.                 |
| `npm run format`       | `prettier --write .` | Format all files in place.                    |
| `npm run format:check` | `prettier --check .` | Verify formatting without writing changes.    |
| `npm run db:generate`  | `prisma generate`    | Generate the Prisma client.                   |
| `npm run db:push`      | `prisma db push`     | Sync the schema to the local SQLite database. |
| `npm test`             | `vitest run`         | Run the test suite once.                      |

## Database setup

```bash
cp .env.example .env.local
npm run db:generate
npm run db:push
```

## Folder structure

The source is organized to keep UI, API routes, and shared utilities clearly separated:

| Path                | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `src/app/`          | App Router pages and layouts (UI). `layout.tsx` is the root shell. |
| `src/app/api/`      | API route handlers. Each `route.ts` exports HTTP method handlers.  |
| `src/lib/`          | Shared utilities, constants, and types reused across the app.      |
| `src/**/__tests__/` | Colocated test files run by Vitest.                                |

The `@/*` path alias maps to `./src/*`, so import shared code with
`import { HEALTH_STATUS } from "@/lib/health"`.

## Environment configuration

Environment variables are managed with `.env.local` files, which are **git-ignored** so
secrets are never committed. Start from the documented template:

```bash
cp .env.example .env.local
```

- [`.env.example`](./.env.example) — committed template documenting available variables. It
  contains **no secrets**.
- `.env.local` — your local, git-ignored copy with real values.

Real variables for the database and authentication arrive in issues #2 (auth) and #3
(PostgreSQL schema). The health-check route is intentionally database-free so the app runs
before those are provisioned.

## License

Private — internal MVP foundation.
