# V2 Scope

This document defines the intended `v2` boundary for Obsidian Writing Workbench after the local-safe backend delivered in `v1`.

## V2 objective

Deliver a workflow-aware retrieval and diagnostics layer while preserving the project’s original positioning as a **portable backend for an Obsidian vault**, not a UI-heavy app. `v2` should make the system more useful for ChatGPT, Codex, and future MCP clients while keeping remote-ready seams visible in the architecture.

## Primary user

- A single writer with an expanding local vault.
- Wants stronger retrieval, related-note discovery, and vault-health visibility.
- Still local-first, with remote hardening designed separately.

## In scope

### Retrieval and ranking

- Replace scan-on-every-request behavior with index-backed retrieval where it improves responsiveness.
- Add better result ranking using note kind, title hits, exact ID matches, and link proximity.
- Return richer search summaries and snippets for API and MCP clients.

### Note graph and workflow traversal

- Traverse relationships between topics, sources, claims, outlines, and drafts.
- Support “show me what is related to this note or topic” flows.
- Surface missing or weak link coverage in the writing workflow.

### Vault diagnostics

- Detect invalid notes, unresolved IDs, missing linked notes, and orphaned work items.
- Add clearer vault-health summaries for agents and humans.
- Separate actionable warnings from informational drift signals.

### Worker-backed indexing

- Promote the worker from scaffold to useful index-refresh orchestration.
- Support explicit refresh passes for search and diagnostics.
- Keep all background work non-destructive and observable.

### Remote-ready backend seam

- Preserve a clean separation between local-only execution and future remote-safe deployment.
- Prepare abstraction points for sync, auth, request tracing, and rate-limits without turning `v2` into a full deployment project.
- Keep MCP and API contracts stable so thin future clients can reuse the same backend behavior.

### Surface parity

- Expose new retrieval and diagnostics capabilities through both the Fastify API and MCP tools.
- Keep request/response semantics aligned across both surfaces.

### Developer experience

- Add realistic dev-vault fixtures for link graphs and broken-reference cases.
- Add tests for ranking, traversal, diagnostics, and worker refresh behavior.

## Release criteria

`v2` should not be considered complete until all of the following are true:

1. Search quality is visibly stronger than plain scan-and-match for the dev vault.
2. Related-note traversal works across the five core note kinds.
3. Vault diagnostics can clearly report broken links, invalid notes, and orphaned notes.
4. Worker-backed refresh flows exist for index and diagnostics passes.
5. API and MCP expose matching retrieval and diagnostics capabilities.
6. The codebase keeps a clear seam for future remote-safe deployment rather than collapsing into a local-only design.
7. Tests cover ranking, traversal, and diagnostics regressions.

## Explicitly deferred

- Remote authentication and multi-user vault access.
- Destructive operations such as delete, move, and rename.
- Heavy web UI or full Obsidian plugin UX.
- Embeddings or vector infrastructure unless simple indexed retrieval proves insufficient.
- Autonomous content rewriting beyond explicit note creation or update calls.

## Design constraints

- Keep the vault Markdown-first and inspectable outside the app.
- Prefer explicit note links and traceable diagnostics over hidden automation.
- Keep worker jobs observable, repeatable, and safe to rerun.
- Preserve the `v1` safety model while improving usefulness.
