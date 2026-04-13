# Contributing

This document explains the local development loop, the testing strategy, and how to make changes safely.

## Prerequisites

- Node.js 20+ (v24 recommended)
- pnpm 9+

## Setup

```bash
pnpm install
pnpm seed:dev-vault
```

## Build

Build all packages and apps from the repo root:

```bash
pnpm build
```

Or build a specific package:

```bash
.\node_modules\.bin\tsc.CMD -p packages/note-schema/tsconfig.json
```

> **Note (Windows):** `pnpm`/`npx` may be blocked by PowerShell execution policy. Use `.\node_modules\.bin\tsc.CMD` and `.\node_modules\.bin\vitest.CMD` directly if needed.

## Unit and integration tests

Run all tests from the repo root:

```bash
.\node_modules\.bin\vitest.CMD run
```

Tests live in `apps/**/test/` and `packages/**/test/`. The test suite covers:

- Folder policy enforcement (`packages/core/test/folder-policy.test.ts`)
- Schema normalization (`packages/note-schema/test/schemas.test.ts`)
- Note factories and ID/path generation (`packages/note-schema/test/`)
- API integration (`apps/api-server/test/server.test.ts`)
- MCP tool dispatch (`apps/mcp-server/test/tools.test.ts`)

## Dev-vault smoke tests

Smoke tests run against the real `sandbox/dev-vault` and are excluded from the default test run:

```bash
pnpm smoke:dev-vault
```

Run smoke tests after:

- Changing folder policy or vault paths
- Adding a new API route or MCP tool
- Modifying `sandbox/dev-vault` note content

## End-to-end tests

The repo also includes a build-artifact e2e test that exercises the seeded vault through the API server, worker refresh flow, and MCP tool dispatcher.

```bash
pnpm build
pnpm test:e2e
pnpm test:e2e:api
pnpm test:e2e:mcp
```

This path uses Node's built-in test runner against compiled `dist/` files with `--test-isolation=none`, so it remains useful even when child-process-based tooling is blocked by local process restrictions.

## Local dev vault

`sandbox/dev-vault` contains one representative note per note kind. It is excluded from Git.

Generate or refresh it with:

```bash
pnpm seed:dev-vault
pnpm seed:dev-vault:clean
```

Use it to test the API server and MCP server against realistic content without coupling the project to your production vault.

## Changing the folder policy

The folder policy is defined in `packages/core/src/folder-policy.ts`. It is used by:

1. `VaultAdapter` (enforcement)
2. `SearchService` (readable scan)
3. MCP and API servers (via VaultAdapter)

Update `packages/core/test/folder-policy.test.ts` when changing policy.

## Adding a new note kind

1. Add the kind to `noteKinds` in `packages/core/src/domain.ts`.
2. Add schema, summary type, and factory in `packages/note-schema/`.
3. Add an API route in `apps/api-server/src/server.ts`.
4. Add an MCP tool definition and handler case in `apps/mcp-server/src/tools.ts`.
5. Rebuild all packages and run the full test suite.

## Before committing

```bash
.\node_modules\.bin\tsc.CMD -p packages/core/tsconfig.json
.\node_modules\.bin\tsc.CMD -p packages/note-schema/tsconfig.json
.\node_modules\.bin\tsc.CMD -p packages/search/tsconfig.json
.\node_modules\.bin\tsc.CMD -p packages/vault-adapter/tsconfig.json
.\node_modules\.bin\tsc.CMD -p apps/api-server/tsconfig.json
.\node_modules\.bin\tsc.CMD -p apps/mcp-server/tsconfig.json
.\node_modules\.bin\vitest.CMD run
pnpm smoke:dev-vault
node --test --test-isolation=none e2e/dev-vault.e2e.test.mjs
node --test --test-isolation=none e2e/api-http.e2e.test.mjs
node --test --test-isolation=none e2e/mcp-stdio.e2e.test.mjs
```

All unit/integration tests, smoke tests, and e2e tests must pass.
