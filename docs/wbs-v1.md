# WBS for V1

This work breakdown structure is intentionally lightweight. It is meant to keep delivery focused, not to become a heavyweight project-management artifact.

Status values used here:

- `done`
- `active`
- `next`
- `later`
- `deferred`

## 1. Product framing

- `done` Define product intent and backend-first strategy.
- `done` Define current architecture and package boundaries.
- `done` Publish roadmap, v1 scope, and WBS documents.
- `next` Define explicit v1 release criteria in one checklist that can gate release readiness.

## 2. Domain and safety

- `done` Define core note types and shared schemas.
- `done` Define readable, writable, and protected folder policy.
- `done` Enforce vault-root and relative-path guards.
- `done` Support safe shared note factories.
- `done` Finalize note ID and filename strategy.
- `done` Split write behavior into clearer create-only and update-only operations.
- `deferred` Add destructive operations only behind explicit design and safety review.

## 3. Note creation workflows

- `done` Validate arbitrary note documents before write.
- `done` Add template-driven note generation.
- `done` Add claim-note creation helper.
- `done` Add source-note creation helper.
- `done` Add outline-note creation helper.
- `done` Add draft-note creation helper.
- `next` Define how cross-note links should be created or maintained.

## 4. API surface

- `done` Add health, policy, list, read, and upsert routes.
- `done` Add note validation route.
- `done` Add template note creation route.
- `done` Add claim creation route.
- `done` Add source, outline, and draft creation routes.

- `next` Add clearer error payloads for skipped or invalid notes.

## 5. MCP surface

- `done` Add list, read, validate, template-create, claim-create, upsert, and policy tools.
- `done` Add source, outline, and draft creation tools.
- `done` Add vault diagnostics and status tools.
- `later` Add remote transport once auth and deployment rules are defined.

## 6. Retrieval and worker

- `done` Add scan-based search and note listing.
- `next` Add invalid-note reporting and vault health summaries.
- `next` Add worker-backed index refresh hooks.
- `later` Add richer ranking and graph traversal.
- `later` Add semantic retrieval only if the simpler model proves insufficient.

## 7. Verification

- `done` Add folder policy tests.
- `done` Add schema normalization tests.
- `done` Add note factory tests.
- `done` Add API integration tests.
- `next` Add MCP integration tests.
- `next` Add regression tests around path and ID generation.
- `next` Add repeatable dev-vault smoke checks.

## 8. Documentation and developer UX

- `done` Add README with architecture and safety rules.
- `done` Add local dev vault guidance.
- `done` Add planning documents.
- `next` Add contribution and testing guide.
- `next` Add examples showing expected note creation flows end to end.

## Suggested delivery order

1. Finish source, outline, and draft creation helpers.
2. Add vault status and diagnostics.
3. Finalize ID/path rules and create-only/update-only semantics.
4. Expand tests around MCP and diagnostics.
5. Reassess whether retrieval or remote work is the next highest-value milestone.
