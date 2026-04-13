import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  createClaimNote,
  createDraftNote,
  createOutlineNote,
  createSourceNote,
  createNoteFromTemplate
} from "@oww/note-schema";
import { type AnyNoteDocument } from "@oww/core";

export const DEV_VAULT_FOLDERS = [
  "00 Inbox/AI",
  "01 Topics",
  "02 Sources",
  "03 Claims",
  "04 Outlines",
  "05 Drafts",
  "06 Finals",
  "07 Templates",
  "90 Archive"
] as const;

const DEFAULT_SEED_TIME = new Date("2026-04-10T00:00:00.000Z");

const DEV_VAULT_TEMPLATE_FILES = [
  {
    path: "07 Templates/topic-template.md",
    body: [
      "# Topic Template",
      "",
      "- Frame the writing question.",
      "- Define scope and non-goals.",
      "- Link initial sources, claims, outlines, and drafts."
    ].join("\n")
  },
  {
    path: "07 Templates/source-template.md",
    body: [
      "# Source Template",
      "",
      "- Capture citation metadata.",
      "- Summarize the source in your own words.",
      "- Explain why it matters to the topic."
    ].join("\n")
  },
  {
    path: "07 Templates/claim-template.md",
    body: [
      "# Claim Template",
      "",
      "- State the claim clearly.",
      "- Record supporting evidence and counterpoints.",
      "- Track confidence and linked sources."
    ].join("\n")
  },
  {
    path: "07 Templates/outline-template.md",
    body: [
      "# Outline Template",
      "",
      "- Introduce the topic and stakes.",
      "- Organize claims and supporting sources.",
      "- End with the main takeaway or next question."
    ].join("\n")
  },
  {
    path: "07 Templates/draft-template.md",
    body: [
      "# Draft Template",
      "",
      "- Start with a zero draft.",
      "- Keep references to topic, outline, claims, and sources visible.",
      "- Tighten structure after the first pass."
    ].join("\n")
  }
] as const;

export interface SeedDevVaultOptions {
  vaultRoot: string;
  clean?: boolean;
  now?: Date;
}

export interface SeedDevVaultResult {
  vaultRoot: string;
  folderPaths: string[];
  notePaths: string[];
  templatePaths: string[];
}

export function buildDevVaultNotes(now: Date = DEFAULT_SEED_TIME): AnyNoteDocument[] {
  const topic = createNoteFromTemplate(
    {
      type: "topic",
      id: "topic-portable-ai-writing-backend",
      path: "01 Topics/portable-ai-writing-backend.md",
      title: "Portable AI Writing Backend",
      status: "active",
      tags: ["backend", "mcp", "vault"],
      question: "How should a portable AI-assisted writing backend for an Obsidian vault be designed?",
      scope: "Backend architecture, safety boundaries, retrieval workflows, and MCP compatibility.",
      sourceIds: ["source-mcp-spec"],
      claimIds: ["claim-vault-source-of-truth"],
      outlineIds: ["outline-portable-backend"],
      draftIds: ["draft-portable-backend-v1"],
      body: [
        "## Context",
        "",
        "This topic anchors the local writing workflow for a portable Obsidian backend.",
        "",
        "## Why It Matters",
        "",
        "The vault should stay canonical while AI clients remain constrained helpers.",
        "",
        "## Next Moves",
        "",
        "- Review related source and claim notes.",
        "- Evolve the outline before revising the draft."
      ].join("\n")
    },
    { now }
  );

  const source = createSourceNote(
    {
      id: "source-mcp-spec",
      path: "02 Sources/model-context-protocol-spec.md",
      title: "Model Context Protocol specification",
      topicIds: [topic.frontmatter.id],
      claimIds: ["claim-vault-source-of-truth"],
      sourceKind: "website",
      authors: ["Anthropic"],
      url: "https://spec.modelcontextprotocol.io",
      citation: "Anthropic. Model Context Protocol specification.",
      publishedAt: "2026-01-01",
      reliability: "high",
      status: "active",
      tags: ["protocol", "mcp"],
      body: [
        "## Summary",
        "",
        "The MCP spec shows how AI clients can call constrained tools instead of directly mutating user state.",
        "",
        "## Relevance",
        "",
        "This supports the backend-first design where the vault remains the source of truth."
      ].join("\n")
    },
    { now }
  );

  const claim = createClaimNote(
    {
      id: "claim-vault-source-of-truth",
      path: "03 Claims/vault-source-of-truth.md",
      title: "The vault should remain the source of truth",
      statement:
        "The writing system should treat the Obsidian vault as canonical state, with AI clients acting through validated backend tools.",
      topicIds: [topic.frontmatter.id],
      sourceIds: [source.frontmatter.id],
      stance: "supporting",
      confidence: 0.92,
      status: "active",
      tags: ["architecture", "safety"],
      body: [
        "## Why This Matters",
        "",
        "A vault-first model preserves inspectability, portability, and recovery when clients change.",
        "",
        "## Counterpoints",
        "",
        "- Direct client writes are faster, but they weaken policy enforcement."
      ].join("\n")
    },
    { now }
  );

  const outline = createOutlineNote(
    {
      id: "outline-portable-backend",
      path: "04 Outlines/portable-backend-outline.md",
      title: "Portable backend architecture outline",
      topicId: topic.frontmatter.id,
      claimIds: [claim.frontmatter.id],
      sourceIds: [source.frontmatter.id],
      stage: "working",
      targetAudience: "Developers building local AI-assisted writing workflows",
      writingGoal: "Explain why backend-first architecture is safer and more portable than UI-first tooling.",
      status: "active",
      tags: ["outline", "backend"],
      body: [
        "## Opening",
        "",
        "- Frame the vault as the canonical system boundary.",
        "",
        "## Body",
        "",
        "- Explain folder policy.",
        "- Explain shared schema validation.",
        "- Explain MCP and API parity.",
        "",
        "## Closing",
        "",
        "- Connect local safety to future remote hardening."
      ].join("\n")
    },
    { now }
  );

  const draft = createDraftNote(
    {
      id: "draft-portable-backend-v1",
      path: "05 Drafts/portable-backend-zero-draft.md",
      title: "Draft on building a portable backend",
      topicId: topic.frontmatter.id,
      outlineId: outline.frontmatter.id,
      claimIds: [claim.frontmatter.id],
      sourceIds: [source.frontmatter.id],
      stage: "zero-draft",
      targetWords: 1200,
      status: "review",
      tags: ["draft", "essay"],
      body: [
        "## Draft",
        "",
        "A portable AI writing backend should keep the Obsidian vault canonical while exposing safe API and MCP surfaces.",
        "",
        "The first pass should explain folder policy, validated writes, and retrieval workflows before discussing remote deployment."
      ].join("\n")
    },
    { now }
  );

  return [topic, source, claim, outline, draft];
}

export async function seedDevVault(options: SeedDevVaultOptions): Promise<SeedDevVaultResult> {
  const vaultRoot = path.resolve(options.vaultRoot);

  if (options.clean) {
    await fs.rm(vaultRoot, { recursive: true, force: true });
  }

  const folderPaths: string[] = [];
  for (const folder of DEV_VAULT_FOLDERS) {
    const folderPath = path.join(vaultRoot, folder);
    await fs.mkdir(folderPath, { recursive: true });
    folderPaths.push(folderPath);
  }

  const notePaths: string[] = [];
  for (const note of buildDevVaultNotes(options.now)) {
    const absolutePath = path.join(vaultRoot, note.path);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, serializeNote(note), "utf8");
    notePaths.push(note.path);
  }

  const templatePaths: string[] = [];
  for (const template of DEV_VAULT_TEMPLATE_FILES) {
    const absolutePath = path.join(vaultRoot, template.path);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, `${template.body}\n`, "utf8");
    templatePaths.push(template.path);
  }

  return {
    vaultRoot,
    folderPaths,
    notePaths: notePaths.sort(),
    templatePaths: templatePaths.sort()
  };
}

function serializeNote(note: AnyNoteDocument): string {
  const sanitizedFrontmatter = Object.fromEntries(
    Object.entries(note.frontmatter as unknown as Record<string, unknown>).filter(([_key, value]) => value !== undefined)
  );

  return matter.stringify(note.body, sanitizedFrontmatter);
}
