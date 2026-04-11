# V2 Demo Guide

This short walkthrough demonstrates the current `v2` retrieval and diagnostics capabilities locally.

## Option 1: One-command console demo

From the repo root, run:

```bash
corepack pnpm demo:v2
```

This runs both example flows:

1. `examples/flows/topic-to-related.ts`
   - seeds a topic in a temporary vault
   - creates a source and claim
   - prints ranked search hits with snippets
   - prints related notes and diagnostics summary

2. `examples/flows/topic-to-draft.ts`
   - seeds a topic in a temporary vault
   - creates source → claim → outline → draft
   - prints vault status at the end

## Option 2: Live API demo against the dev vault

Start the API server against the built-in sandbox vault:

```powershell
$env:VAULT_ROOT = "./sandbox/dev-vault"
corepack pnpm dev:api
```

Then open these URLs in a browser:

- `http://127.0.0.1:3000/health`
- `http://127.0.0.1:3000/notes?query=portable`
- `http://127.0.0.1:3000/notes/related?id=topic-portable-ai-writing-backend`
- `http://127.0.0.1:3000/vault/diagnostics`
- `http://127.0.0.1:3000/vault/status`

## Option 3: Worker refresh snapshot

To show the retrieval/diagnostics snapshot being rebuilt:

```powershell
$env:VAULT_ROOT = "./sandbox/dev-vault"
$env:WORKER_INDEX_PATH = Join-Path $env:TEMP "oww-worker-index.json"
corepack pnpm refresh:worker
Get-Content $env:WORKER_INDEX_PATH
```

## What to look for

- Ranked `hits` include `score` and `snippet`
- `related` results show linked notes and `missingIds`
- diagnostics report `brokenLinks` and `orphanedNotes`
- worker refresh output includes the current diagnostics summary
