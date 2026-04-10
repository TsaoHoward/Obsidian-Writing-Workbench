# V1 Scope

This document defines the intended v1 boundary for Obsidian Writing Workbench.

## V1 objective

Deliver a safe, backend-oriented writing system for an Obsidian vault where:

- the vault remains the source of truth
- AI clients operate through constrained backend tools
- core writing notes can be read, validated, and created without a heavy UI

## Primary user

- A single writer working against one Obsidian vault.
- Local execution first.
- AI help focused on research organization, note creation, outlining, and drafting support.

## In scope

### Core domain

- Topic, source, claim, outline, and draft note schemas.
- Shared frontmatter validation.
- Shared note factories for safe note creation.

### Safety model

- Readable folder policy.
- Writable folder policy.
- Protected folder policy.
- Path normalization and vault-root enforcement.

### Backend capabilities

- Scan readable Markdown notes.
- Read validated notes.
- Validate note documents before write.
- Create or update notes only in writable folders.
- Generate typed notes from built-in templates.

### Surfaces

- Local Fastify API server.
- Local MCP server over stdio.
- Worker scaffold for later indexing and diagnostics.

### Developer experience

- Local dev vault support.
- Minimal automated tests for safety and behavior.
- Clear docs for architecture, scope, and roadmap.

## Release criteria

V1 should not be considered complete until all of the following are true:

1. Source, claim, outline, and draft notes can be created through shared backend helpers.
2. Protected folders reject writes consistently from API, MCP, and internal adapters.
3. The API and MCP server expose matching safe write capabilities.
4. Invalid notes can be surfaced clearly enough for debugging.
5. The local dev workflow is documented and reproducible.

## Explicitly deferred

- Delete, move, or rename operations.
- Writes to finals by default.
- Rich web frontend.
- Obsidian plugin UI as the primary interface.
- Remote authentication and multi-user support.
- Semantic search, embeddings, and vector infrastructure.
- Autonomous background content rewriting.

## Design constraints

- The backend must not assume one AI client.
- The vault format must stay Markdown-first and inspectable outside the app.
- Shared logic should live in packages, not be duplicated per surface.
- Risky capabilities should be scaffolded only when clearly marked as deferred or disabled.

## Open questions for v1 completion

- What should the final ID and filename strategy be for collision handling?
- Should note creation update backlinks or related-note references automatically?
- What is the right status view for skipped or invalid notes?
- Where should create-only versus update-only semantics live?
