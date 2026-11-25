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
`api/src/repositories/generated/`, git-ignored), PostgreSQL, Zod, Vitest, ESLint, Prettier.

Use the **context7** MCP (`.mcp.json`) to check current docs before using an API of Express, Prisma,
Zod or Vitest — several of them had breaking majors recently (Express 5, Prisma 7, Zod 4).

## Architecture (layered + pure domain) — inside `api/src/`

Requests flow one way: `routes → controllers → services → repositories → db`. `domain/` is used by services and
depends on nothing.

- `domain/` — pure business rules: send-time calculation, reminder text, SI/NO parsing, `Clock`
  interface. No imports from Express, Prisma or other layers; never call `new Date()` here.
- `services/` — business logic per resource (appointments, reminders, inbound…). Uses domain,
  repositories and the message provider. Receives dependencies through the constructor.
- `repositories/` — data access with Prisma (`prisma.ts` = shared client, `generated/` = Prisma
  client, git-ignored). No business rules.
- `clients/` — HTTP client for the messaging provider (the root `provider/` is the fake server it
  calls). It is the only interface: it is faked in tests.
- `routes/` — Express routers: only map URL + method to a controller method
  (`error-handler.ts`: 404 and errors → `{ "error": "<message>" }`).
- `controllers/` — HTTP glue: validate input (Zod), call a service, build the response (status +
  body). No business rules.
- `env.ts` — env validation.
- `app.ts` builds Express from already-wired controllers; `main.ts` is the only place that creates concrete
  instances and wires them (no DI container).

Folders are created when their first file is added. Dates in responses are UTC ISO with `Z`.

## Commands

From the repo root:

    docker compose up --build        # full stack, migrations run on start (api on :3000)
    docker compose up -d db provider # only dependencies, for local dev (db on host port 5433)

From `api/`:

    npm run dev          # local server (needs .env, copy from .env.example)
    npm test             # vitest
    npm run lint         # eslint (type-checked rules)
    npm run typecheck
    npm run format       # prettier

Before finishing a task: `npm run typecheck && npm run lint && npm test` must pass (in `api/`).
