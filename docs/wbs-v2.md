# WBS for V2

This work breakdown structure keeps `v2` focused on retrieval, diagnostics, and workflow visibility after `v1` acceptance.

Status values used here:

- `done`
- `active`
- `next`
- `later`
- `deferred`

## 1. Retrieval foundation

- `done` Design a lightweight in-memory indexed search model that preserves current safety boundaries.
- `done` Add stronger ranking signals for title, ID, and frontmatter matches.
- `done` Return better snippets and summaries for search results.
- `later` Reassess whether semantic retrieval is needed after indexed search lands.

## 2. Note graph traversal

- `done` Define traversal rules between topic, source, claim, outline, and draft notes.
- `done` Add related-note queries for topic-centric workflows.
- `later` Add richer graph views once the basic traversal contract stabilizes.

## 3. Vault diagnostics

- `done` Detect broken links, unresolved IDs, and orphaned notes.
- `done` Expand invalid-note reporting into a broader vault-health summary.
- `done` Separate actionable errors from low-priority drift warnings.

## 4. Worker and indexing

- `done` Replace the current worker placeholder loop with explicit refresh jobs.
- `done` Add repeatable indexing hooks for retrieval and diagnostics passes.
- `later` Add scheduled or event-driven refresh once the local job model is stable.

## 5. Remote-ready backend seam

- `next` Identify the interfaces that must stay stable for future remote use.
- `next` Prepare seams for auth, request tracing, and rate-limits without implementing the full remote stack yet.
- `later` Add sync/deployment adapters only after the retrieval and diagnostics contract is proven.

## 6. API and MCP surface

- `done` Add matching retrieval and diagnostics endpoints to the API.
- `done` Add corresponding MCP tools with aligned argument and result shapes.
- `later` Consider remote transport only after auth and deployment rules are defined.

## 7. Verification and performance

- `done` Add regression tests for ranking, traversal, and diagnostics.
- `next` Expand dev-vault fixtures to include broken-link and cross-note scenarios.
- `next` Add a lightweight benchmark or smoke check for indexed retrieval.

## 8. Documentation and examples

- `next` Publish the `v2` scope and work breakdown docs.
- `done` Add one end-to-end example showing topic-to-related-notes discovery.
- `later` Add operator guidance for running refresh and diagnostics workflows.

## Suggested delivery order

1. Define the retrieval contract and ranking rules.
2. Add worker-backed index refresh hooks.
3. Implement related-note traversal and vault diagnostics.
4. Preserve the remote-ready backend seam while exposing the same capabilities through API and MCP.
5. Expand tests, fixtures, and examples before cutting `v2`.
