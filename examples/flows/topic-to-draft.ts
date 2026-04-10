/**
 * End-to-end flow: topic → source → claim → outline → draft
 *
 * This script demonstrates the complete note creation workflow using the API
 * server directly (no network required). Run it from the repo root:
 *
 *   node --import tsx/esm examples/flows/topic-to-draft.ts
 *
 * Or via ts-node / vitest --reporter=verbose for annotated output.
 *
 * The script creates a temporary vault, walks through every creation step,
 * and prints the resulting note paths and IDs.
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
  // 1. Set up a temporary vault.
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "oww-flow-example-"));
  for (const folder of VAULT_FOLDERS) {
    await mkdir(path.join(vaultRoot, folder), { recursive: true });
  }

  const app = buildServer({ vaultRoot, host: "127.0.0.1", port: 3000 });

  try {
    console.log("=== Obsidian Writing Workbench: topic → draft flow ===\n");

    // ── Step 1: Seed a readable topic note, then read it through the API ─────
    const topicPath = "01 Topics/topic-portable-ai-writing-backend.md";
    await writeFile(
      path.join(vaultRoot, topicPath),
      `---
id: topic-portable-ai-writing-backend
type: topic
title: Portable AI Writing Backend
status: active
tags:
  - backend
  - mcp
createdAt: 2026-04-10T00:00:00Z
updatedAt: 2026-04-10T00:00:00Z
question: How should a portable AI-assisted writing backend for an Obsidian vault be designed?
scope: Backend architecture, safety boundaries, and MCP compatibility.
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
    console.log(`[1/5] Topic seeded and read`);
    console.log(`      path: ${topic.path}`);
    console.log(`      id:   ${topic.frontmatter.id}\n`);

    // ── Step 2: Create a source note linked to the topic ─────────────────────
    const sourceRes = await app.inject({
      method: "POST",
      url: "/sources",
      payload: {
        title: "Model Context Protocol specification",
        topicIds: [topic.frontmatter.id],
        sourceKind: "website",
        authors: ["Anthropic"],
        url: "https://spec.modelcontextprotocol.io"
      }
    });
    const { note: source } = sourceRes.json();
    console.log(`[2/5] Source created`);
    console.log(`      path: ${source.path}`);
    console.log(`      id:   ${source.frontmatter.id}\n`);

    // ── Step 3: Create a claim note linked to topic and source ───────────────
    const claimRes = await app.inject({
      method: "POST",
      url: "/claims",
      payload: {
        title: "The vault should remain the source of truth",
        statement: "All AI writes must go through the backend policy layer; the vault is never written directly by an AI client.",
        topicIds: [topic.frontmatter.id],
        sourceIds: [source.frontmatter.id],
        stance: "supporting",
        confidence: 0.95
      }
    });
    const { note: claim } = claimRes.json();
    console.log(`[3/5] Claim created`);
    console.log(`      path: ${claim.path}`);
    console.log(`      id:   ${claim.frontmatter.id}\n`);

    // ── Step 4: Create an outline note linking all of the above ──────────────
    const outlineRes = await app.inject({
      method: "POST",
      url: "/outlines",
      payload: {
        title: "Portable backend architecture outline",
        topicId: topic.frontmatter.id,
        claimIds: [claim.frontmatter.id],
        sourceIds: [source.frontmatter.id],
        stage: "seed",
        targetAudience: "Developers setting up a local AI writing assistant",
        writingGoal: "Explain why the vault-first safety model scales to remote deployments"
      }
    });
    const { note: outline } = outlineRes.json();
    console.log(`[4/5] Outline created`);
    console.log(`      path: ${outline.path}`);
    console.log(`      id:   ${outline.frontmatter.id}\n`);

    // ── Step 5: Create a draft note anchored to the outline ──────────────────
    const draftRes = await app.inject({
      method: "POST",
      url: "/drafts",
      payload: {
        title: "Portable backend architecture — zero draft",
        topicId: topic.frontmatter.id,
        outlineId: outline.frontmatter.id,
        claimIds: [claim.frontmatter.id],
        sourceIds: [source.frontmatter.id],
        stage: "zero-draft",
        targetWords: 1200
      }
    });
    const { note: draft } = draftRes.json();
    console.log(`[5/5] Draft created`);
    console.log(`      path: ${draft.path}`);
    console.log(`      id:   ${draft.frontmatter.id}\n`);

    // ── Summary: vault status ────────────────────────────────────────────────
    const statusRes = await app.inject({ method: "GET", url: "/vault/status" });
    const status = statusRes.json();
    console.log(`=== Vault status ===`);
    console.log(`Total notes: ${status.totalNotes}`);
    for (const k of status.byKind) {
      if (k.count > 0) console.log(`  ${k.kind}: ${k.count}`);
    }
    if (status.skipped.length > 0) {
      console.log(`\nSkipped (${status.skipped.length}):`);
      for (const s of status.skipped) console.log(`  [${s.code}] ${s.path} — ${s.reason}`);
    }
    console.log(`\nAll 5 notes created successfully. Flow complete.`);
  } finally {
    await app.close();
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error("Flow example failed:", error);
  process.exitCode = 1;
});
