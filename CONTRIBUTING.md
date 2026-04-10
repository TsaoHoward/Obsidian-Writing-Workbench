# Contributing

This document explains the local development loop, the testing strategy, and how to make changes safely.

## Prerequisites

- Node.js 20+ (v24 recommended)
- pnpm 9+

## Setup

```bash
pnpm install
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
.\node_modules\.bin\vitest.CMD run --config vitest.smoke.config.ts
```

Run smoke tests after:

- Changing folder policy or vault paths
- Adding a new API route or MCP tool
- Modifying `sandbox/dev-vault` note content

## Local dev vault

`sandbox/dev-vault` contains one representative note per note kind. It is excluded from Git.

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
.\node_modules\.bin\vitest.CMD run --config vitest.smoke.config.ts
```

All 38 unit/integration tests and 7 smoke tests must pass.
