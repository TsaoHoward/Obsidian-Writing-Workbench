import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildServer } from "../apps/api-server/dist/server.js";
import { dispatchTool } from "../apps/mcp-server/dist/tools.js";
import { runRefreshJob } from "../apps/worker/dist/refresh-job.js";
import { SearchService } from "../packages/search/dist/search-service.js";
import { seedDevVault } from "../packages/vault-adapter/dist/dev-vault.js";
import { VaultAdapter } from "../packages/vault-adapter/dist/vault-adapter.js";

test("seeded vault supports API create flow, worker refresh, and MCP reads", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "oww-e2e-"));
  const vaultRoot = path.join(tempRoot, "dev-vault");
  const indexPath = path.join(tempRoot, "worker-index.json");

  const vaultAdapter = new VaultAdapter({ vaultRoot });
  const searchService = new SearchService(vaultAdapter);
  const app = buildServer({ vaultRoot, host: "127.0.0.1", port: 3000 });

  try {
    await seedDevVault({ vaultRoot, clean: true });

    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().ok, true);

    const statusBefore = await app.inject({ method: "GET", url: "/vault/status" });
    assert.equal(statusBefore.statusCode, 200);
    assert.equal(statusBefore.json().totalNotes, 5);

    const sourceResponse = await app.inject({
      method: "POST",
      url: "/sources",
      payload: {
        title: "Portable indexing design memo",
        topicIds: ["topic-portable-ai-writing-backend"],
        claimIds: ["claim-vault-source-of-truth"],
        sourceKind: "article",
        authors: ["Workbench team"],
        reliability: "medium",
        body: "This memo captures how retrieval indexing should stay lightweight and observable."
      }
    });
    assert.equal(sourceResponse.statusCode, 201);
    const createdSource = sourceResponse.json().note;

    const claimResponse = await app.inject({
      method: "POST",
      url: "/claims",
      payload: {
        title: "Index refreshes should stay explicit",
        statement: "Explicit refresh passes make retrieval state observable and easier to debug.",
        topicIds: ["topic-portable-ai-writing-backend"],
        sourceIds: [createdSource.frontmatter.id],
        stance: "supporting",
        confidence: 0.88
      }
    });
    assert.equal(claimResponse.statusCode, 201);
    const createdClaim = claimResponse.json().note;

    const relatedResponse = await app.inject({
      method: "GET",
      url: "/notes/related?id=topic-portable-ai-writing-backend"
    });
    assert.equal(relatedResponse.statusCode, 200);
    const related = relatedResponse.json();
    assert.equal(related.missingIds.length, 0);
    assert.ok(related.related.some((entry) => entry.note.id === createdSource.frontmatter.id));
    assert.ok(related.related.some((entry) => entry.note.id === createdClaim.frontmatter.id));

    const refreshResult = await runRefreshJob(
      searchService,
      {
        vaultRoot,
        pollMs: 1000,
        runMode: "once",
        indexPath
      },
      "manual"
    );
    assert.equal(refreshResult.summary.totalNotes, 7);
    assert.equal(refreshResult.summary.invalidCount, 0);
    assert.equal(refreshResult.summary.diagnostics.brokenLinks, 0);
    assert.equal(refreshResult.summary.diagnostics.orphanedNotes, 0);

    const savedIndex = JSON.parse(await readFile(indexPath, "utf8"));
    assert.equal(savedIndex.summary.totalNotes, 7);
    assert.equal(savedIndex.summary.diagnostics.issueCount, 0);

    const mcpRead = await dispatchTool(
      "read_note",
      { path: createdSource.path },
      { vaultAdapter, searchService }
    );
    assert.equal(mcpRead.isError, undefined);
    const readNote = JSON.parse(mcpRead.content[0].text);
    assert.equal(readNote.frontmatter.id, createdSource.frontmatter.id);

    const mcpSearch = await dispatchTool(
      "list_notes",
      { query: "explicit refresh passes", limit: 5 },
      { vaultAdapter, searchService }
    );
    assert.equal(mcpSearch.isError, undefined);
    const searchPayload = JSON.parse(mcpSearch.content[0].text);
    assert.ok(searchPayload.hits.some((hit) => hit.note.id === createdClaim.frontmatter.id));

    const mcpDiagnostics = await dispatchTool(
      "get_vault_diagnostics",
      {},
      { vaultAdapter, searchService }
    );
    assert.equal(mcpDiagnostics.isError, undefined);
    const diagnostics = JSON.parse(mcpDiagnostics.content[0].text);
    assert.equal(diagnostics.summary.brokenLinks, 0);
    assert.equal(diagnostics.summary.orphanedNotes, 0);
  } finally {
    await app.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});
