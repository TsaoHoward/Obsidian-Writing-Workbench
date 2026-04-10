/**
 * End-to-end flow: topic → source → claim → related notes + diagnostics
 *
 * This script demonstrates the retrieval side of the writing workflow using the
 * API server directly (no network required). Run it from the repo root:
 *
 *   node --import tsx/esm examples/flows/topic-to-related.ts
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildServer } from "../../apps/api-server/src/server.js";

const VAULT_FOLDERS = [
  "00 Inbox/AI",
  "01 Topics",
  "02 Sources",
  "03 Claims",
  "04 Outlines",
  "05 Drafts",
  "06 Finals",
  "07 Templates",
  "90 Archive"
];

async function run() {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "oww-related-flow-"));
  for (const folder of VAULT_FOLDERS) {
    await mkdir(path.join(vaultRoot, folder), { recursive: true });
  }

  const app = buildServer({ vaultRoot, host: "127.0.0.1", port: 3000 });

  try {
    console.log("=== Obsidian Writing Workbench: topic → related notes flow ===\n");

    const topicPath = "01 Topics/topic-portable-retrieval-workflow.md";
    await writeFile(
      path.join(vaultRoot, topicPath),
      `---
id: topic-portable-retrieval-workflow
type: topic
title: Portable retrieval workflow
status: active
tags:
  - retrieval
  - diagnostics
createdAt: 2026-04-10T00:00:00Z
updatedAt: 2026-04-10T00:00:00Z
question: How can related-note discovery stay safe and useful in an Obsidian-backed workflow?
scope: Search ranking, note graph traversal, and diagnostics.
sourceIds: []
claimIds: []
outlineIds: []
draftIds: []
---

Seeded topic body.
`,
      "utf8"
    );

    const topicRes = await app.inject({
      method: "GET",
      url: `/note?path=${encodeURIComponent(topicPath)}`
    });
    const { note: topic } = topicRes.json();
    console.log(`[1/4] Topic seeded and read: ${topic.frontmatter.id}`);

    const sourceRes = await app.inject({
      method: "POST",
      url: "/sources",
      payload: {
        title: "Retrieval design notes",
        topicIds: [topic.frontmatter.id],
        sourceKind: "article",
        authors: ["Workbench team"]
      }
    });
    const { note: source } = sourceRes.json();
    console.log(`[2/4] Source created: ${source.frontmatter.id}`);

    const claimRes = await app.inject({
      method: "POST",
      url: "/claims",
      payload: {
        title: "Related-note discovery needs diagnostics",
        statement: "Useful retrieval should show both connected notes and broken references.",
        topicIds: [topic.frontmatter.id],
        sourceIds: [source.frontmatter.id],
        stance: "supporting",
        confidence: 0.92
      }
    });
    const { note: claim } = claimRes.json();
    console.log(`[3/4] Claim created: ${claim.frontmatter.id}`);

    const searchRes = await app.inject({
      method: "GET",
      url: "/notes?query=related-note%20discovery"
    });
    const search = searchRes.json();
    console.log("\n=== Ranked search hits ===");
    for (const hit of search.hits) {
      console.log(`- ${hit.note.id} (score ${hit.score})`);
      console.log(`  snippet: ${hit.snippet}`);
    }

    const relatedRes = await app.inject({
      method: "GET",
      url: `/notes/related?id=${encodeURIComponent(topic.frontmatter.id)}`
    });
    const related = relatedRes.json();
    console.log("\n=== Related notes for topic ===");
    for (const entry of related.related) {
      console.log(`- ${entry.note.id} via ${entry.reasons.join(", ")}`);
    }
    if (related.missingIds.length > 0) {
      console.log(`Missing linked IDs: ${related.missingIds.join(", ")}`);
    }

    const diagnosticsRes = await app.inject({ method: "GET", url: "/vault/diagnostics" });
    const diagnostics = diagnosticsRes.json();
    console.log("\n=== Diagnostics summary ===");
    console.log(JSON.stringify(diagnostics.summary, null, 2));

    console.log("\n[4/4] Related-note flow complete.");
  } finally {
    await app.close();
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error("Related-note flow example failed:", error);
  process.exitCode = 1;
});
