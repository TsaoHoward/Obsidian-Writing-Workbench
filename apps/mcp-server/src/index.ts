import { validateNoteDocument } from "@oww/note-schema";
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
