import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import {
  createClaimNote,
  createClaimNoteInputSchema,
  createNoteFromTemplate,
  createNoteFromTemplateInputSchema,
  validateNoteDocument
} from "@oww/note-schema";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { loadMcpServerConfig } from "./config.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

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

async function main() {
  const config = loadMcpServerConfig();
  const vaultAdapter = new VaultAdapter({
    vaultRoot: config.vaultRoot
  });
  const searchService = new SearchService(vaultAdapter);

  const server = new Server(
    {
      name: "obsidian-writing-workbench",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "oww.list_notes",
        description: "List or search readable notes from the Obsidian writing vault.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["topic", "source", "claim", "outline", "draft"]
            },
            query: {
              type: "string"
            },
            limit: {
              type: "number"
            }
          }
        }
      },
      {
        name: "oww.read_note",
        description: "Read a validated note from the vault by relative path.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string"
            }
          },
          required: ["path"]
        }
      },
      {
        name: "oww.validate_note",
        description: "Validate and normalize a note document without writing it to the vault.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string"
            },
            frontmatter: {
              type: "object"
            },
            body: {
              type: "string"
            }
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
            type: {
              type: "string",
              enum: ["topic", "source", "claim", "outline", "draft"]
            },
            title: {
              type: "string"
            },
            id: {
              type: "string"
            },
            path: {
              type: "string"
            },
            status: {
              type: "string",
              enum: ["seed", "active", "review", "done"]
            },
            tags: {
              type: "array",
              items: {
                type: "string"
              }
            },
            body: {
              type: "string"
            },
            write: {
              type: "boolean"
            },
            question: {
              type: "string"
            },
            scope: {
              type: "string"
            },
            sourceIds: {
              type: "array",
              items: {
                type: "string"
              }
            },
            claimIds: {
              type: "array",
              items: {
                type: "string"
              }
            },
            outlineIds: {
              type: "array",
              items: {
                type: "string"
              }
            },
            draftIds: {
              type: "array",
              items: {
                type: "string"
              }
            },
            topicIds: {
              type: "array",
              items: {
                type: "string"
              }
            },
            sourceKind: {
              type: "string",
              enum: ["article", "paper", "book", "podcast", "video", "website", "interview", "other"]
            },
            authors: {
              type: "array",
              items: {
                type: "string"
              }
            },
            url: {
              type: "string"
            },
            citation: {
              type: "string"
            },
            publishedAt: {
              type: "string"
            },
            reliability: {
              type: "string",
              enum: ["high", "medium", "low"]
            },
            statement: {
              type: "string"
            },
            stance: {
              type: "string",
              enum: ["supporting", "counter", "open-question"]
            },
            confidence: {
              type: "number"
            },
            topicId: {
              type: "string"
            },
            stage: {
              type: "string"
            },
            targetAudience: {
              type: "string"
            },
            writingGoal: {
              type: "string"
            },
            outlineId: {
              type: "string"
            },
            targetWords: {
              type: "number"
            }
          },
          oneOf: [
            {
              properties: {
                type: { const: "topic" }
              },
              required: ["type", "title"]
            },
            {
              properties: {
                type: { const: "source" }
              },
              required: ["type", "title"]
            },
            {
              properties: {
                type: { const: "claim" }
              },
              required: ["type", "title"]
            },
            {
              properties: {
                type: { const: "outline" },
                stage: { type: "string", enum: ["seed", "working", "ready"] }
              },
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
            title: {
              type: "string"
            },
            statement: {
              type: "string"
            },
            topicIds: {
              type: "array",
              items: {
                type: "string"
              }
            },
            sourceIds: {
              type: "array",
              items: {
                type: "string"
              }
            },
            stance: {
              type: "string",
              enum: ["supporting", "counter", "open-question"]
            },
            confidence: {
              type: "number"
            },
            id: {
              type: "string"
            },
            path: {
              type: "string"
            },
            status: {
              type: "string",
              enum: ["seed", "active", "review", "done"]
            },
            tags: {
              type: "array",
              items: {
                type: "string"
              }
            },
            body: {
              type: "string"
            }
          },
          required: ["title", "statement", "topicIds"]
        }
      },
      {
        name: "oww.upsert_note",
        description: "Create or update a note in a writable vault folder.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string"
            },
            frontmatter: {
              type: "object"
            },
            body: {
              type: "string"
            }
          },
          required: ["path", "frontmatter", "body"]
        }
      },
      {
        name: "oww.get_policy",
        description: "Return the active readable, writable, and protected folder policy.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case "oww.list_notes": {
          const args = listNotesArgsSchema.parse(request.params.arguments ?? {});
          const baseOptions = {
            ...(args.type ? { type: args.type } : {}),
            ...(typeof args.limit === "number" ? { limit: args.limit } : {})
          };
          const result =
            args.query && args.query.length > 0
              ? await searchService.searchNotes({
                  ...baseOptions,
                  query: args.query
                })
              : await searchService.listNotes(baseOptions);

          return asTextResult(result);
        }

        case "oww.read_note": {
          const args = readNoteArgsSchema.parse(request.params.arguments ?? {});
          const result = await vaultAdapter.readValidatedNote(args.path);
          return asTextResult(result);
        }

        case "oww.validate_note": {
          const args = upsertNoteArgsSchema.parse(request.params.arguments ?? {});
          const result = validateNoteDocument(args);
          return asTextResult({
            valid: true,
            note: result
          });
        }

        case "oww.create_note_from_template": {
          const write = createTemplateCommandSchema.parse(request.params.arguments ?? {}).write ?? false;
          const args = createNoteFromTemplateInputSchema.parse(request.params.arguments ?? {});
          const note = createNoteFromTemplate(args);
          const result = write
            ? {
                note: await vaultAdapter.upsertNote(note),
                persisted: true
              }
            : {
                note,
                persisted: false
              };
          return asTextResult(result);
        }

        case "oww.create_claim_note": {
          const args = createClaimNoteInputSchema.parse(request.params.arguments ?? {});
          const note = createClaimNote(args);
          const result = await vaultAdapter.upsertNote(note);
          return asTextResult({ note: result });
        }

        case "oww.upsert_note": {
          const args = upsertNoteArgsSchema.parse(request.params.arguments ?? {});
          const note = validateNoteDocument(args);
          const result = await vaultAdapter.upsertNote(note);
          return asTextResult(result);
        }

        case "oww.get_policy": {
          return asTextResult(vaultAdapter.getPolicy());
        }

        default:
          return asErrorResult(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      return asErrorResult(error instanceof Error ? error.message : "Unknown tool error");
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // TODO: Add authenticated remote transport only after the local policy model is proven stable.
}

function asTextResult(value: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function asErrorResult(message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message
      }
    ]
  };
}

main().catch((error) => {
  console.error("MCP server failed to start.", error);
  process.exitCode = 1;
});
