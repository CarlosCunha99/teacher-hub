# [MVP] Initialize Next.js project foundation and developer workflow

**Issue:** #1 (GitHub: CarlosCunha99/teacher-hub)  
**Author:** Carlos Cunha  
**Labels:** enhancement, mvp  

## User Story
As a teacher using Teacher Hub, I want a stable and well-structured application foundation so that core features can be developed and delivered reliably.

## Scope
Set up baseline Next.js app structure, API route conventions, environment config approach, and shared engineering standards for MVP delivery.

## Acceptance Criteria
- [ ] Next.js app is scaffolded with a clear folder structure for UI, API routes, and shared utilities.
- [ ] Environment variable strategy is documented and supports local development.
- [ ] Basic health-check API route exists and returns a successful response.
- [ ] Linting and formatting scripts are configured in `package.json`.
- [ ] README includes startup instructions and high-level architecture notes.
- [ ] CI-ready scripts exist for install, lint, and test/build commands.

## Background
This is a foundation issue for the MVP — subsequent issues (#2-#8) will build on this. The repo currently has only a README.md and .gitignore (possibly from a prior PO agent run on branch teacher-hub-mvp-foundation). The tech stack is Next.js (React) + Node.js API routes + PostgreSQL.
