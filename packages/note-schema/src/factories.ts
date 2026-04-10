import {
  claimStanceValues,
  draftStageValues,
  noteKinds,
  noteStatusValues,
  outlineStageValues,
  sourceKindValues,
  type AnyNoteDocument,
  type NoteKind
} from "@oww/core";
import { z } from "zod";
import { validateNoteDocument } from "./schemas.js";

const nonEmptyString = z.string().trim().min(1);
const idSchema = nonEmptyString;

const createBaseTemplateInputSchema = z.object({
  type: z.enum(noteKinds),
  title: nonEmptyString,
  id: idSchema.optional(),
  path: nonEmptyString.optional(),
  status: z.enum(noteStatusValues).default("seed"),
  tags: z.array(nonEmptyString).default([]),
  body: z.string().optional()
});

const createTopicTemplateInputSchema = createBaseTemplateInputSchema.extend({
  type: z.literal("topic"),
  question: nonEmptyString.optional(),
  scope: nonEmptyString.optional(),
  sourceIds: z.array(idSchema).default([]),
  claimIds: z.array(idSchema).default([]),
  outlineIds: z.array(idSchema).default([]),
  draftIds: z.array(idSchema).default([])
});

const createSourceTemplateInputSchema = createBaseTemplateInputSchema.extend({
  type: z.literal("source"),
  sourceKind: z.enum(sourceKindValues).default("website"),
  authors: z.array(nonEmptyString).default([]),
  url: z.string().url().optional(),
  citation: nonEmptyString.optional(),
  publishedAt: nonEmptyString.optional(),
  topicIds: z.array(idSchema).default([]),
  claimIds: z.array(idSchema).default([]),
  reliability: z.enum(["high", "medium", "low"]).optional()
});

const createClaimTemplateInputSchema = createBaseTemplateInputSchema.extend({
  type: z.literal("claim"),
  statement: nonEmptyString.optional(),
  stance: z.enum(claimStanceValues).default("supporting"),
  topicIds: z.array(idSchema).default([]),
  sourceIds: z.array(idSchema).default([]),
  confidence: z.number().min(0).max(1).optional()
});

const createOutlineTemplateInputSchema = createBaseTemplateInputSchema.extend({
  type: z.literal("outline"),
  topicId: idSchema,
  claimIds: z.array(idSchema).default([]),
  sourceIds: z.array(idSchema).default([]),
  stage: z.enum(outlineStageValues).default("seed"),
  targetAudience: nonEmptyString.optional(),
  writingGoal: nonEmptyString.optional()
});

const createDraftTemplateInputSchema = createBaseTemplateInputSchema.extend({
  type: z.literal("draft"),
  topicId: idSchema,
  outlineId: idSchema.optional(),
  claimIds: z.array(idSchema).default([]),
  sourceIds: z.array(idSchema).default([]),
  stage: z.enum(draftStageValues).default("zero-draft"),
  targetWords: z.number().int().positive().optional()
});

export const createNoteFromTemplateInputSchema = z.discriminatedUnion("type", [
  createTopicTemplateInputSchema,
  createSourceTemplateInputSchema,
  createClaimTemplateInputSchema,
  createOutlineTemplateInputSchema,
  createDraftTemplateInputSchema
]);

export const createClaimNoteInputSchema = z.object({
  title: nonEmptyString,
  statement: nonEmptyString,
  topicIds: z.array(idSchema).min(1),
  sourceIds: z.array(idSchema).default([]),
  stance: z.enum(claimStanceValues).default("supporting"),
  confidence: z.number().min(0).max(1).optional(),
  id: idSchema.optional(),
  path: nonEmptyString.optional(),
  status: z.enum(noteStatusValues).default("seed"),
  tags: z.array(nonEmptyString).default([]),
  body: z.string().optional()
});

export type CreateNoteFromTemplateInput = z.infer<typeof createNoteFromTemplateInputSchema>;
export type CreateClaimNoteInput = z.infer<typeof createClaimNoteInputSchema>;

export interface NoteFactoryOptions {
  now?: Date;
}

const folderByKind: Record<NoteKind, string> = {
  topic: "01 Topics",
  source: "02 Sources",
  claim: "03 Claims",
  outline: "04 Outlines",
  draft: "05 Drafts"
};

export function createNoteFromTemplate(
  input: CreateNoteFromTemplateInput,
  options: NoteFactoryOptions = {}
): AnyNoteDocument {
  const parsed = createNoteFromTemplateInputSchema.parse(input);
  const now = options.now ?? new Date();
  const createdAt = now.toISOString();
  const resolvedId = parsed.id ?? buildDefaultId(parsed.type, parsed.title, now);
  const resolvedPath = buildNotePath(parsed.type, parsed.title, now, parsed.path, resolvedId);
  const body = parsed.body ?? buildDefaultBody(parsed);

  switch (parsed.type) {
    case "topic":
      return validateNoteDocument({
        path: resolvedPath,
        frontmatter: {
          id: resolvedId,
          type: parsed.type,
          title: parsed.title,
          status: parsed.status,
          tags: parsed.tags,
          createdAt,
          updatedAt: createdAt,
          question: parsed.question ?? `How should "${parsed.title}" be framed?`,
          scope: parsed.scope,
          sourceIds: parsed.sourceIds,
          claimIds: parsed.claimIds,
          outlineIds: parsed.outlineIds,
          draftIds: parsed.draftIds
        },
        body
      });

    case "source":
      return validateNoteDocument({
        path: resolvedPath,
        frontmatter: {
          id: resolvedId,
          type: parsed.type,
          title: parsed.title,
          status: parsed.status,
          tags: parsed.tags,
          createdAt,
          updatedAt: createdAt,
          sourceKind: parsed.sourceKind,
          authors: parsed.authors,
          url: parsed.url,
          citation: parsed.citation,
          publishedAt: parsed.publishedAt,
          topicIds: parsed.topicIds,
          claimIds: parsed.claimIds,
          reliability: parsed.reliability
        },
        body
      });

    case "claim":
      return validateNoteDocument({
        path: resolvedPath,
        frontmatter: {
          id: resolvedId,
          type: parsed.type,
          title: parsed.title,
          status: parsed.status,
          tags: parsed.tags,
          createdAt,
          updatedAt: createdAt,
          statement: parsed.statement ?? parsed.title,
          stance: parsed.stance,
          topicIds: parsed.topicIds,
          sourceIds: parsed.sourceIds,
          confidence: parsed.confidence
        },
        body
      });

    case "outline":
      return validateNoteDocument({
        path: resolvedPath,
        frontmatter: {
          id: resolvedId,
          type: parsed.type,
          title: parsed.title,
          status: parsed.status,
          tags: parsed.tags,
          createdAt,
          updatedAt: createdAt,
          topicId: parsed.topicId,
          claimIds: parsed.claimIds,
          sourceIds: parsed.sourceIds,
          stage: parsed.stage,
          targetAudience: parsed.targetAudience,
          writingGoal: parsed.writingGoal
        },
        body
      });

    case "draft":
      return validateNoteDocument({
        path: resolvedPath,
        frontmatter: {
          id: resolvedId,
          type: parsed.type,
          title: parsed.title,
          status: parsed.status,
          tags: parsed.tags,
          createdAt,
          updatedAt: createdAt,
          topicId: parsed.topicId,
          outlineId: parsed.outlineId,
          claimIds: parsed.claimIds,
          sourceIds: parsed.sourceIds,
          stage: parsed.stage,
          targetWords: parsed.targetWords
        },
        body
      });
  }
}

export function createClaimNote(
  input: CreateClaimNoteInput,
  options: NoteFactoryOptions = {}
): AnyNoteDocument {
  const parsed = createClaimNoteInputSchema.parse(input);

  return createNoteFromTemplate(
    {
      type: "claim",
      title: parsed.title,
      statement: parsed.statement,
      topicIds: parsed.topicIds,
      sourceIds: parsed.sourceIds,
      stance: parsed.stance,
      confidence: parsed.confidence,
      id: parsed.id,
      path: parsed.path,
      status: parsed.status,
      tags: parsed.tags,
      body: parsed.body
    },
    options
  );
}

function buildDefaultId(type: NoteKind, title: string, now: Date): string {
  const slug = slugify(title);
  return `${type}-${slug.length > 0 ? slug : buildTimestampSegment(now)}`;
}

function buildNotePath(
  type: NoteKind,
  title: string,
  now: Date,
  customPath: string | undefined,
  resolvedId: string
): string {
  if (customPath) {
    return ensureMarkdownPath(customPath);
  }

  const slug = slugify(resolvedId) || slugify(title) || buildTimestampSegment(now);
  return `${folderByKind[type]}/${slug}.md`;
}

function ensureMarkdownPath(relativePath: string): string {
  const trimmed = relativePath.trim();
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/[^A-Za-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "-")
    .toLowerCase();
}

function buildTimestampSegment(input: Date): string {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, "0");
  const day = String(input.getUTCDate()).padStart(2, "0");
  const hours = String(input.getUTCHours()).padStart(2, "0");
  const minutes = String(input.getUTCMinutes()).padStart(2, "0");
  const seconds = String(input.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function buildDefaultBody(input: CreateNoteFromTemplateInput): string {
  switch (input.type) {
    case "topic":
      return [
        "## Context",
        "",
        "Capture the topic, why it matters, and what still needs to be answered.",
        "",
        "## Open Questions",
        "",
        "- Add the most important unresolved questions here."
      ].join("\n");

    case "source":
      return [
        "## Summary",
        "",
        "Capture the main ideas from the source.",
        "",
        "## Extracts",
        "",
        "- Add quotes or paraphrases here.",
        "",
        "## Relevance",
        "",
        "Explain why this source matters to the topic."
      ].join("\n");

    case "claim":
      return [
        "## Claim",
        "",
        input.statement ?? input.title,
        "",
        "## Why this matters",
        "",
        "Explain why this claim matters in the argument.",
        "",
        "## Supporting evidence",
        "",
        "- Add supporting sources or observations.",
        "",
        "## Counterpoints",
        "",
        "- Record objections or unresolved tensions."
      ].join("\n");

    case "outline":
      return [
        "## Opening",
        "",
        "- Introduce the topic and its stakes.",
        "",
        "## Body",
        "",
        "- Organize the main claims and supporting sources.",
        "",
        "## Closing",
        "",
        "- Summarize the takeaway and next question."
      ].join("\n");

    case "draft":
      return ["## Draft", "", "Start the draft here."].join("\n");
  }
}

// TODO: Externalize built-in templates into a versioned registry once note formats stabilize across clients.
