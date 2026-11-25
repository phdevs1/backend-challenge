# CLAUDE.md

Instructions for AI agents working on this repo. The challenge statement is `enunciado.pdf`; the API
contract is `openapi.yaml` (never modify it, nor `provider/`).

## Git

**Never create commits, branches or pushes.** The developer commits manually.

## Repo layout

- `api/` — our service (everything below lives here; run npm commands from `api/`).
- `provider/` — fake messaging provider given by the challenge. Do not modify.
- `docker-compose.yml` — `api` + `db` (Postgres) + `provider`.
- `openapi.yaml` — API contract the graders test against.

## Stack

Node 22+, TypeScript (strict, ESM/NodeNext → relative imports end in `.js`), Express 5, Prisma 7
(`prisma-client` generator + `@prisma/adapter-pg`, client generated into
`api/src/shared/db/generated/`, git-ignored), PostgreSQL, Zod, Vitest, ESLint, Prettier.

Use the **context7** MCP (`.mcp.json`) to check current docs before using an API of Express, Prisma,
Zod or Vitest — several of them had breaking majors recently (Express 5, Prisma 7, Zod 4).

## Architecture (feature folders, layered inside each) — inside `api/src/`

One folder per feature (`clinics/`, `patients/`, later `appointments/`, `reminders/`, `inbound/`…).
Inside a feature, requests flow one way: `routes → controller → service → repository → db`.
Each feature holds its files side by side:

- `<feature>.routes.ts` — Express router: only maps URL + method to a controller method.
- `<feature>.controller.ts` — HTTP glue: validate input (Zod), call a service, build the response
  (status + body). No business rules.
- `<feature>.service.ts` — business logic. Uses the feature's domain, repositories and the message
  provider. Receives dependencies through the constructor.
- `<feature>.repository.ts` — data access with Prisma. No business rules.
- `<entity>.ts` — pure domain: types and business rules of the feature (send-time calculation,
  reminder text, SI/NO parsing…). No imports from Express, Prisma or other layers.

A feature may import another feature's service/repository/domain (e.g. patients checks that the
clinic exists); keep those dependencies one-directional and avoid cycles.

- `shared/` — what no single feature owns: `clock.ts` (`Clock` interface + `SystemClock`/`TestClock`),
  `errors.ts` (domain errors), `error-handler.ts` (404 and errors → `{ "error": "<message>" }`),
  `validation.ts`/`schemas.ts` (Zod helpers), `db/prisma.ts` (shared client) and `db/generated/`
  (Prisma client, git-ignored). Outside `shared/clock.ts`, never call `new Date()` / `Date.now()`
  for the current time: use the injected `Clock`.
- `clients/` — HTTP client for the messaging provider (the root `provider/` is the fake server it
  calls). It is the only interface: it is faked in tests.
- `routes.ts` — joins every feature router (`app.ts` just mounts it).
- `env.ts` — env validation.
- `wiring.ts` — composition root: the only place that creates repositories, services and
  controllers (no DI container) and defines the `Controllers` type. `main.ts` calls it with the real
  DB; integration tests with the test DB. `app.ts` builds Express from those controllers.

Folders are created when their first file is added. Dates in responses are UTC ISO with `Z`.

## Tests

Test only what the requirements ask for (`enunciado.pdf`, `openapi.yaml`) or a behaviour we
explicitly decided (documented in the README). No tests for internals, framework behaviour or
cases nobody asked for.

Tests mirror `src/`: one folder per feature (`test/clinics/`, `test/patients/`, `test/health/`…), and
the file name says the kind of test:

- `<feature>.routes.test.ts` — HTTP tests without database (`fakeControllers()` + overrides).
- `<feature>.integration.test.ts` — real app (`useTestApp()`: same wiring as main.ts +
  `TestClock`) against the `clinicsay_test` database, created/migrated by `test/global-setup.ts`
  and emptied before each test. Override its URL with `TEST_DATABASE_URL`.
- `<name>.unit.test.ts` — pure unit tests of the domain rules (`test/<feature>/`, or `test/shared/`
  for `shared/clock.ts`).
- `test/helpers/` — shared test utilities (`fake-controllers.ts`, `test-app.ts`…).

New migration: change `prisma/schema.prisma`, then `npx prisma migrate dev --name <what>` and
`npx prisma generate` (Prisma 7 no longer generates on migrate).

## Commands

From the repo root:

    docker compose up --build        # full stack, migrations run on start (api on :3000)
    docker compose up -d db provider # only dependencies, for local dev (db on host port 5433)

From `api/`:

    npm run dev          # local server (needs .env, copy from .env.example)
    npm test             # vitest: unit + integration (needs `docker compose up -d db`)
    npm run lint         # eslint (type-checked rules)
    npm run typecheck
    npm run format       # prettier

Before finishing a task: `npm run format:check && npm run typecheck && npm run lint && npm test` must
pass (in `api/`). CI (`.github/workflows/ci.yml`) runs exactly these plus `npm run build` and a
`docker compose up` smoke test (`/health` + `PUT /test/clock`) on every push to `main` and every PR.
