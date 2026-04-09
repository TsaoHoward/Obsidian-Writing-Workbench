import {
  claimStanceValues,
  draftStageValues,
  noteStatusValues,
  outlineStageValues,
  sourceKindValues,
  type AnyNoteDocument,
  type AnyNoteFrontmatter
} from "@oww/core";
import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);
const idSchema = nonEmptyString;
const dateTimeSchema = nonEmptyString;

export const baseFrontmatterSchema = z.object({
  id: idSchema,
  type: z.enum(["topic", "source", "claim", "outline", "draft"]),
  title: nonEmptyString,
  status: z.enum(noteStatusValues).default("seed"),
  tags: z.array(nonEmptyString).default([]),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema
});

export const topicNoteFrontmatterSchema = baseFrontmatterSchema.extend({
  type: z.literal("topic"),
  question: nonEmptyString,
  scope: nonEmptyString.optional(),
  sourceIds: z.array(idSchema).default([]),
  claimIds: z.array(idSchema).default([]),
  outlineIds: z.array(idSchema).default([]),
  draftIds: z.array(idSchema).default([])
});

export const sourceNoteFrontmatterSchema = baseFrontmatterSchema.extend({
  type: z.literal("source"),
  sourceKind: z.enum(sourceKindValues),
  authors: z.array(nonEmptyString).default([]),
  url: z.string().url().optional(),
  citation: nonEmptyString.optional(),
  publishedAt: nonEmptyString.optional(),
  topicIds: z.array(idSchema).default([]),
  claimIds: z.array(idSchema).default([]),
  reliability: z.enum(["high", "medium", "low"]).optional()
});

export const claimNoteFrontmatterSchema = baseFrontmatterSchema.extend({
  type: z.literal("claim"),
  statement: nonEmptyString,
  stance: z.enum(claimStanceValues),
  topicIds: z.array(idSchema).default([]),
  sourceIds: z.array(idSchema).default([]),
  confidence: z.number().min(0).max(1).optional()
});

export const outlineNoteFrontmatterSchema = baseFrontmatterSchema.extend({
  type: z.literal("outline"),
  topicId: idSchema,
  claimIds: z.array(idSchema).default([]),
  sourceIds: z.array(idSchema).default([]),
  stage: z.enum(outlineStageValues),
  targetAudience: nonEmptyString.optional(),
  writingGoal: nonEmptyString.optional()
});

export const draftNoteFrontmatterSchema = baseFrontmatterSchema.extend({
  type: z.literal("draft"),
  topicId: idSchema,
  outlineId: idSchema.optional(),
  claimIds: z.array(idSchema).default([]),
  sourceIds: z.array(idSchema).default([]),
  stage: z.enum(draftStageValues),
  targetWords: z.number().int().positive().optional()
});

export const anyNoteFrontmatterSchema = z.discriminatedUnion("type", [
  topicNoteFrontmatterSchema,
  sourceNoteFrontmatterSchema,
  claimNoteFrontmatterSchema,
  outlineNoteFrontmatterSchema,
  draftNoteFrontmatterSchema
]);

export const anyNoteDocumentSchema = z.object({
  path: z.string().trim().min(1).regex(/\.md$/i, "Vault note paths must end in .md"),
  frontmatter: anyNoteFrontmatterSchema,
  body: z.string()
});

export function validateFrontmatter(input: unknown): AnyNoteFrontmatter {
  return anyNoteFrontmatterSchema.parse(input) as AnyNoteFrontmatter;
}

export function validateNoteDocument(input: unknown): AnyNoteDocument {
  return anyNoteDocumentSchema.parse(input) as AnyNoteDocument;
}

export function safeValidateNoteDocument(input: unknown) {
  return anyNoteDocumentSchema.safeParse(input);
}
