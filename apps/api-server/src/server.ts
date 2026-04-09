import {
  NoteValidationError,
  PolicyViolationError,
  WorkbenchError,
  noteKinds
} from "@oww/core";
import { validateNoteDocument } from "@oww/note-schema";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import Fastify from "fastify";
import { z } from "zod";
import { type ApiServerConfig } from "./config.js";

const listNotesQuerySchema = z.object({
  type: z.enum(noteKinds).optional(),
  query: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const readNoteQuerySchema = z.object({
  path: z.string().trim().min(1)
});

const upsertNoteBodySchema = z.object({
  path: z.string().trim().min(1),
  frontmatter: z.record(z.string(), z.unknown()),
  body: z.string()
});

export function buildServer(config: ApiServerConfig) {
  const app = Fastify({
    logger: true
  });

  const vaultAdapter = new VaultAdapter({
    vaultRoot: config.vaultRoot
  });
  const searchService = new SearchService(vaultAdapter);

  app.get("/health", async () => ({
    ok: true,
    service: "api-server"
  }));

  app.get("/policies", async () => ({
    policy: vaultAdapter.getPolicy()
  }));

  app.get("/notes", async (request) => {
    const query = listNotesQuerySchema.parse(request.query);
    const baseOptions = {
      ...(query.type ? { type: query.type } : {}),
      ...(typeof query.limit === "number" ? { limit: query.limit } : {})
    };

    if (query.query && query.query.length > 0) {
      return searchService.searchNotes({
        ...baseOptions,
        query: query.query,
      });
    }

    return searchService.listNotes(baseOptions);
  });

  app.get("/note", async (request) => {
    const query = readNoteQuerySchema.parse(request.query);
    const note = await vaultAdapter.readValidatedNote(query.path);

    return { note };
  });

  app.put("/note", async (request, reply) => {
    const body = upsertNoteBodySchema.parse(request.body);
    const note = validateNoteDocument(body);
    const savedNote = await vaultAdapter.upsertNote(note);

    reply.code(200);
    return { note: savedNote };
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = getStatusCode(error);
    const errorLike = toErrorLike(error);

    reply.status(statusCode).send({
      error: errorLike.name,
      message: errorLike.message,
      details: error instanceof WorkbenchError ? error.details : undefined
    });
  });

  // TODO: Add auth, request tracing, and rate-limits before any remote deployment.
  return app;
}

function getStatusCode(error: unknown): number {
  if (error instanceof PolicyViolationError) {
    return 403;
  }

  if (error instanceof NoteValidationError || error instanceof z.ZodError) {
    return 400;
  }

  if (error instanceof WorkbenchError) {
    return 500;
  }

  return 500;
}

function toErrorLike(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    name: "UnknownError",
    message: "An unknown error occurred."
  };
}
