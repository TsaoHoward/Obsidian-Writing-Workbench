# Roadmap

This document describes the product direction and milestone plan for Obsidian Writing Workbench as of April 10, 2026.

## Product goals

- Make the Obsidian vault the canonical source of truth for the writing workflow.
- Provide a safe backend that AI clients can use without owning the vault structure.
- Stay portable across local and future remote setups.
- Keep the system client-agnostic so ChatGPT, Codex, and other MCP-compatible tools can share the same backend.

## Direction

- Backend-first, not UI-first.
- Local-first, with remote readiness designed in but deferred.
- Explicit, validated writes only.
- Small composable tools over one large agent surface.
- Thin clients later, shared backend now.

## Current baseline

The current main branch already provides:

- A pnpm TypeScript monorepo with clean package boundaries.
- Shared note schemas and folder safety policy.
- Safe vault scanning, reads, and constrained writes.
- A Fastify API server.
- An MCP stdio server.
- Local dev vault support.
- Template-based note creation and claim-note creation.
- Automated tests for folder policy, schema handling, factories, and API flows.

## Milestones

### M0 Bootstrap foundation

Status: completed

- Establish monorepo structure.
- Define note domain model.
- Add folder policy and path guards.
- Add initial API and MCP surfaces.
- Add local development vault and automated tests.

### M1 Safe note operations

Status: active

- Stabilize note creation helpers for all core note kinds.
- Finalize ID and path generation rules.
- Separate create-only and update-only write modes.
- Add diagnostics for invalid notes and skipped reads.

Exit signal:

- Source, claim, outline, and draft notes can all be created through shared helpers.
- Writes remain blocked for protected folders.
- API and MCP expose the same safe write semantics.

### M2 Core writing workflow

Status: next

- Add `create_source_note`.
- Add `create_outline_note`.
- Add `create_draft_note`.
- Add stronger note-linking helpers between topic, source, claim, outline, and draft notes.
- Add vault status and workflow diagnostics endpoints.

Exit signal:

- A user can move from topic to source to claim to outline to draft through backend tools without hand-building raw frontmatter.

### M3 Retrieval and background jobs

Status: next

- Improve search ranking beyond scan-and-match.
- Add worker-backed indexing hooks.
- Add invalid-note reporting and drift detection.
- Add graph-style traversal for related notes.

Exit signal:

- The system can answer "what is related to this topic?" and "what is broken or missing in this vault?" through backend services.

### M4 Remote-ready backend

Status: later

- Add authentication and request authorization.
- Add deployment and environment hardening for remote use.
- Define single-user versus multi-user vault access rules.
- Add operational safeguards for remote writes.

Exit signal:

- The backend can run outside the local machine without weakening the existing safety model.

### M5 Thin client surfaces

Status: deferred

- Optional Obsidian plugin integration.
- Optional read-focused web status page.
- Optional client-specific UX flows built on the shared API or MCP server.

Constraint:

- These surfaces stay thin and must not duplicate backend logic or bypass folder policy.

## V1 release target

V1 is ready when the backend can safely support the core writing workflow for one local vault:

- Read and validate the five core note types.
- Create source, claim, outline, and draft notes through shared helpers.
- Enforce writable and protected folder policy everywhere.
- Expose the same behavior through API and MCP.
- Provide enough diagnostics to understand vault health.
- Keep destructive operations deferred.

## Immediate next PRs

1. Add source, outline, and draft creation helpers plus corresponding API and MCP tools.
2. Add vault status and diagnostics views for readable, skipped, and protected-path behavior.
3. Add stronger ID, path, and link maintenance rules.
