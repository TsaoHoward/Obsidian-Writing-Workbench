import {
  createClaimNote,
  createClaimNoteInputSchema,
  createDraftNote,
  createDraftNoteInputSchema,
  createNoteFromTemplate,
  createNoteFromTemplateInputSchema,
  createOutlineNote,
  createOutlineNoteInputSchema,
  createSourceNote,
  createSourceNoteInputSchema,
  validateNoteDocument
} from "@oww/note-schema";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import { z } from "zod";

const listNotesArgsSchema = z.object({
  type: z.enum(["topic", "source", "claim", "outline", "draft"]).optional(),
  query: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const readNoteArgsSchema = z.object({
  path: z.string().trim().min(1)
});

const upsertNoteArgsSchema = z.object({
  path: z.string().trim().min(1),
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string()
});

const createTemplateCommandSchema = z.object({
  write: z.boolean().optional()
});

export interface ToolDeps {
  vaultAdapter: VaultAdapter;
  searchService: SearchService;
}

export type ToolResult =
  | { isError?: false; content: [{ type: "text"; text: string }] }
  | { isError: true; content: [{ type: "text"; text: string }] };

export const toolDefinitions = [
  {
    name: "oww.list_notes",
    description: "List or search readable notes from the Obsidian writing vault.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["topic", "source", "claim", "outline", "draft"] },
        query: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "oww.read_note",
    description: "Read a validated note from the vault by relative path.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"]
    }
  },
  {
    name: "oww.validate_note",
    description: "Validate and normalize a note document without writing it to the vault.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        frontmatter: { type: "object" },
        body: { type: "string" }
      },
      required: ["path", "frontmatter", "body"]
    }
  },
  {
    name: "oww.create_note_from_template",
    description:
      "Generate a typed note from a built-in template and optionally persist it when the target folder is writable.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["topic", "source", "claim", "outline", "draft"] },
        title: { type: "string" },
        id: { type: "string" },
        path: { type: "string" },
        status: { type: "string", enum: ["seed", "active", "review", "done"] },
        tags: { type: "array", items: { type: "string" } },
        body: { type: "string" },
        write: { type: "boolean" },
        question: { type: "string" },
        scope: { type: "string" },
        sourceIds: { type: "array", items: { type: "string" } },
        claimIds: { type: "array", items: { type: "string" } },
        outlineIds: { type: "array", items: { type: "string" } },
        draftIds: { type: "array", items: { type: "string" } },
        topicIds: { type: "array", items: { type: "string" } },
        sourceKind: {
          type: "string",
          enum: ["article", "paper", "book", "podcast", "video", "website", "interview", "other"]
        },
        authors: { type: "array", items: { type: "string" } },
        url: { type: "string" },
        citation: { type: "string" },
        publishedAt: { type: "string" },
        reliability: { type: "string", enum: ["high", "medium", "low"] },
        statement: { type: "string" },
        stance: { type: "string", enum: ["supporting", "counter", "open-question"] },
        confidence: { type: "number" },
        topicId: { type: "string" },
        stage: { type: "string" },
        targetAudience: { type: "string" },
        writingGoal: { type: "string" },
        outlineId: { type: "string" },
        targetWords: { type: "number" }
      },
      oneOf: [
        { properties: { type: { const: "topic" } }, required: ["type", "title"] },
        { properties: { type: { const: "source" } }, required: ["type", "title"] },
        { properties: { type: { const: "claim" } }, required: ["type", "title"] },
        {
          properties: { type: { const: "outline" }, stage: { type: "string", enum: ["seed", "working", "ready"] } },
          required: ["type", "title", "topicId"]
        },
        {
          properties: {
            type: { const: "draft" },
            stage: { type: "string", enum: ["zero-draft", "revision", "polish"] }
          },
          required: ["type", "title", "topicId", "outlineId"]
        }
      ]
    }
  },
  {
    name: "oww.create_claim_note",
    description: "Create and persist a claim note in the writable claims folder by default.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        statement: { type: "string" },
        topicIds: { type: "array", items: { type: "string" } },
        sourceIds: { type: "array", items: { type: "string" } },
        stance: { type: "string", enum: ["supporting", "counter", "open-question"] },
        confidence: { type: "number" },
        id: { type: "string" },
        path: { type: "string" },
        status: { type: "string", enum: ["seed", "active", "review", "done"] },
        tags: { type: "array", items: { type: "string" } },
        body: { type: "string" }
      },
      required: ["title", "statement", "topicIds"]
    }
  },
  {
    name: "oww.create_source_note",
    description: "Create and persist a source note in the writable sources folder.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        topicIds: { type: "array", items: { type: "string" } },
        sourceKind: {
          type: "string",
          enum: ["article", "paper", "book", "podcast", "video", "website", "interview", "other"]
        },
        authors: { type: "array", items: { type: "string" } },
        url: { type: "string" },
        citation: { type: "string" },
        publishedAt: { type: "string" },
        claimIds: { type: "array", items: { type: "string" } },
        reliability: { type: "string", enum: ["high", "medium", "low"] },
        id: { type: "string" },
        path: { type: "string" },
        status: { type: "string", enum: ["seed", "active", "review", "done"] },
        tags: { type: "array", items: { type: "string" } },
        body: { type: "string" }
      },
      required: ["title", "topicIds"]
    }
  },
  {
    name: "oww.create_outline_note",
    description: "Create and persist an outline note in the writable outlines folder.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        topicId: { type: "string" },
        claimIds: { type: "array", items: { type: "string" } },
        sourceIds: { type: "array", items: { type: "string" } },
        stage: { type: "string", enum: ["seed", "working", "ready"] },
        targetAudience: { type: "string" },
        writingGoal: { type: "string" },
        id: { type: "string" },
        path: { type: "string" },
        status: { type: "string", enum: ["seed", "active", "review", "done"] },
        tags: { type: "array", items: { type: "string" } },
        body: { type: "string" }
      },
      required: ["title", "topicId"]
    }
  },
  {
    name: "oww.create_draft_note",
    description: "Create and persist a draft note in the writable drafts folder.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        topicId: { type: "string" },
        outlineId: { type: "string" },
        claimIds: { type: "array", items: { type: "string" } },
        sourceIds: { type: "array", items: { type: "string" } },
        stage: { type: "string", enum: ["zero-draft", "revision", "polish"] },
        targetWords: { type: "number" },
        id: { type: "string" },
        path: { type: "string" },
        status: { type: "string", enum: ["seed", "active", "review", "done"] },
        tags: { type: "array", items: { type: "string" } },
        body: { type: "string" }
      },
      required: ["title", "topicId"]
    }
  },
  {
    name: "oww.upsert_note",
    description: "Create or update a note in a writable vault folder.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        frontmatter: { type: "object" },
        body: { type: "string" }
      },
      required: ["path", "frontmatter", "body"]
    }
  },
  {
    name: "oww.get_policy",
    description: "Return the active readable, writable, and protected folder policy.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "oww.get_vault_status",
    description:
      "Return a summary of all valid notes in the vault grouped by kind, plus any notes that failed validation.",
    inputSchema: { type: "object", properties: {} }
  }
] as const;

export async function dispatchTool(name: string, rawArgs: unknown, deps: ToolDeps): Promise<ToolResult> {
  const args = rawArgs ?? {};
  try {
    switch (name) {
      case "oww.list_notes": {
        const parsed = listNotesArgsSchema.parse(args);
        const baseOptions = {
          ...(parsed.type ? { type: parsed.type } : {}),
          ...(typeof parsed.limit === "number" ? { limit: parsed.limit } : {})
        };
        const result =
          parsed.query && parsed.query.length > 0
            ? await deps.searchService.searchNotes({ ...baseOptions, query: parsed.query })
            : await deps.searchService.listNotes(baseOptions);
        return asTextResult(result);
      }

      case "oww.read_note": {
        const parsed = readNoteArgsSchema.parse(args);
        const result = await deps.vaultAdapter.readValidatedNote(parsed.path);
        return asTextResult(result);
      }

      case "oww.validate_note": {
        const parsed = upsertNoteArgsSchema.parse(args);
        const result = validateNoteDocument(parsed);
        return asTextResult({ valid: true, note: result });
      }

      case "oww.create_note_from_template": {
        const write = createTemplateCommandSchema.parse(args).write ?? false;
        const parsed = createNoteFromTemplateInputSchema.parse(args);
        const note = createNoteFromTemplate(parsed);
        const result = write
          ? { note: await deps.vaultAdapter.createNote(note), persisted: true }
          : { note, persisted: false };
        return asTextResult(result);
      }

      case "oww.create_claim_note": {
        const parsed = createClaimNoteInputSchema.parse(args);
        const note = createClaimNote(parsed);
        const result = await deps.vaultAdapter.createNote(note);
        return asTextResult({ note: result });
      }

      case "oww.create_source_note": {
        const parsed = createSourceNoteInputSchema.parse(args);
        const note = createSourceNote(parsed);
        const result = await deps.vaultAdapter.createNote(note);
        return asTextResult({ note: result });
      }

      case "oww.create_outline_note": {
        const parsed = createOutlineNoteInputSchema.parse(args);
        const note = createOutlineNote(parsed);
        const result = await deps.vaultAdapter.createNote(note);
        return asTextResult({ note: result });
      }

      case "oww.create_draft_note": {
        const parsed = createDraftNoteInputSchema.parse(args);
        const note = createDraftNote(parsed);
        const result = await deps.vaultAdapter.createNote(note);
        return asTextResult({ note: result });
      }

      case "oww.upsert_note": {
        const parsed = upsertNoteArgsSchema.parse(args);
        const note = validateNoteDocument(parsed);
        const result = await deps.vaultAdapter.upsertNote(note);
        return asTextResult(result);
      }

      case "oww.get_policy": {
        return asTextResult(deps.vaultAdapter.getPolicy());
      }

      case "oww.get_vault_status": {
        const result = await deps.searchService.getVaultStatus();
        return asTextResult(result);
      }

      default:
        return asErrorResult(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return asErrorResult(error instanceof Error ? error.message : "Unknown tool error");
  }
}

function asTextResult(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }]
  };
}

function asErrorResult(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}
