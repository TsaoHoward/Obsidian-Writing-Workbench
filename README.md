# Obsidian Writing Workbench

Portable AI-assisted writing infrastructure for an Obsidian vault. The vault stays the source of truth, while this repo provides a safe backend, shared note schemas, and an MCP-friendly tool layer for AI clients.

## Purpose

- Support a short-essay workflow built around Markdown notes in an Obsidian vault.
- Keep the system portable across local and remote setups.
- Start with backend services and safety boundaries, not an Obsidian plugin UI or a large web frontend.
- Make future ChatGPT, Codex, and MCP-compatible integrations possible without rewriting the core.

## Architecture

```text
apps/
  api-server/   Fastify HTTP surface for health, policies, note reads, and safe upserts
  mcp-server/   MCP stdio server exposing the same vault capabilities to AI clients
  worker/       Background job scaffold for indexing and future automation
packages/
  core/         Domain types, folder policy, and shared errors
  note-schema/  Zod schemas and runtime validation for note contracts
  vault-adapter/ Safe vault scanning, parsing, and write enforcement
  search/       Minimal scan-based note listing and text search
examples/
  templates/    Example Markdown note templates for each note type
```

### Package boundaries

- `@oww/core` contains no vault IO and no server logic.
- `@oww/note-schema` owns note validation and summary shaping.
- `@oww/vault-adapter` owns path normalization, folder policy enforcement, frontmatter parsing, and safe writes.
- `@oww/search` builds read-side operations on top of the adapter.
- Apps depend on packages, but packages do not depend on apps.

## Domain model

The v1 note model is frontmatter-driven and typed by note kind:

- `TopicNote`: writing question, scope, and links to sources, claims, outlines, and drafts.
- `SourceNote`: citation metadata, authors, source kind, reliability, and topic/claim references.
- `ClaimNote`: claim statement, stance, supporting source IDs, and confidence.
- `OutlineNote`: topic anchor, selected claims/sources, audience, and writing goal.
- `DraftNote`: draft stage, topic linkage, outline linkage, source/claim linkage, and optional target word count.

## MVP scope

### Included in v1

- Scan readable folders for Markdown notes.
- Parse frontmatter with `gray-matter`.
- Validate note contracts with `zod`.
- Enforce read/write folder policy.
- Read validated notes.
- Create or update notes only in approved folders.
- Provide a local Fastify API server.
- Provide an MCP server for AI tools over stdio.

### Deferred

- Delete, move, rename, or bulk rewrite operations.
- Final-note editing.
- Remote authentication and multi-user permissions.
- Embeddings, vector search, or semantic retrieval.
- Obsidian plugin UI.
- Heavy web frontend.

## Folder safety rules

### Readable

- `01 Topics/`
- `02 Sources/`
- `03 Claims/`
- `04 Outlines/`
- `05 Drafts/`

### Writable

- `00 Inbox/AI/`
- `02 Sources/`
- `03 Claims/`
- `04 Outlines/`
- `05 Drafts/`

### Protected

- `06 Finals/`
- `07 Templates/`
- `90 Archive/`

Protected folders are blocked from writes in v1. Destructive operations are intentionally not implemented.

## Quick start

1. Install dependencies with `pnpm install`.
2. Set `VAULT_ROOT` to your Obsidian vault path.
3. Build everything with `pnpm build`.
4. Run the API with `pnpm dev:api`.
5. Run the MCP server with `pnpm dev:mcp`.
6. Run the worker scaffold with `pnpm dev:worker`.

Example environment:

```bash
VAULT_ROOT=/path/to/vault
API_PORT=3000
```

## API and MCP shape

### API routes

- `GET /health`
- `GET /policies`
- `GET /notes`
- `GET /note?path=04 Outlines/example.md`
- `PUT /note`

### MCP tools

- `oww.list_notes`
- `oww.read_note`
- `oww.upsert_note`
- `oww.get_policy`

## Roadmap

### Near-term

- Add stable note creation helpers and stronger note ID conventions.
- Add better search ranking and note graph traversal.
- Add index jobs in the worker.
- Add test coverage around policy enforcement and schema validation.

### Later

- Remote deployment with auth and tenant-aware vault access.
- Richer research ingestion workflows.
- Draft synthesis and revision pipelines.
- Optional UI clients that stay thin and call the shared backend.

## Safety principles

- The vault is the source of truth.
- Writes must be explicit, validated, and folder-constrained.
- Protected folders are never writable in v1.
- Destructive capabilities remain deferred until they are explicitly designed, gated, and tested.
- Shared schemas and shared adapters are preferred over client-specific logic.
