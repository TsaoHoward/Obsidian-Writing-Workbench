# V1 Release Checklist

This checklist gates the v1 release. All items must be checked before tagging `v1.0.0`.

## Domain and safety

- [x] Topic, source, claim, outline, and draft note schemas defined and validated by zod.
- [x] Readable, writable, and protected folder policy enforced in `VaultAdapter`.
- [x] Path normalization and vault-root escape prevention verified by tests.
- [x] `createNote` rejects with 409 if the file already exists.
- [x] `updateNote` rejects with 404 if the file does not exist.
- [x] `upsertNote` available for intentional overwrite.

## Note creation

- [x] `createNoteFromTemplate` generates all five note kinds with deterministic IDs and paths.
- [x] Typed helpers: `createClaimNote`, `createSourceNote`, `createOutlineNote`, `createDraftNote`.
- [x] Cross-note link policy defined: link fields (`topicIds`, `claimIds`, `sourceIds`, etc.) are caller-supplied ID strings. No server-side referential integrity check in v1 — links are declared in frontmatter by the caller, and maintaining reverse links (e.g. adding a draft ID back to the topic's `draftIds`) is left to the calling agent or future worker logic.

## API surface

- [x] `GET /health` returns ok.
- [x] `GET /policies` returns the folder policy.
- [x] `GET /notes` lists and filters readable notes (with optional `type`, `query`, `limit`).
- [x] `GET /note` reads and validates a note by path.
- [x] `POST /notes/validate` validates without writing.
- [x] `POST /notes/template` creates from template (preview or persisted).
- [x] `POST /claims`, `POST /sources`, `POST /outlines`, `POST /drafts` create typed notes.
- [x] `PUT /note` updates an existing note; returns 403 for protected paths, 404 for missing.
- [x] `GET /vault/status` returns note counts by kind and any skipped notes.
- [x] `GET /vault/invalid` returns a structured list of all notes that failed validation.

## MCP surface

- [x] All API capabilities exposed as MCP tools via `dispatchTool`.
- [x] `oww.get_invalid_notes` available for vault health inspection.
- [ ] MCP server starts without error against the dev vault in a real Claude session.

## Verification

- [x] Folder policy tests pass.
- [x] Schema normalization tests pass.
- [x] Note factory tests pass (includes path and ID regression tests).
- [x] API integration tests pass (9 assertions across 3 test groups).
- [x] MCP integration tests pass (12 assertions).
- [x] Dev-vault smoke tests pass (`vitest run --config vitest.smoke.config.ts`).
- [ ] No `console.warn` output from the smoke test for invalid dev-vault notes.

## Developer experience

- [x] README documents architecture, safety model, and local dev setup.
- [x] `sandbox/dev-vault` contains representative notes for each kind.
- [x] `vitest.smoke.config.ts` enables one-command dev-vault smoke verification.
- [x] CONTRIBUTING.md documents the full local dev loop.
- [x] At least one end-to-end example showing note creation from topic to draft (`examples/flows/topic-to-draft.ts`).
