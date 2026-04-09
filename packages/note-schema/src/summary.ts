import { type AnyNoteDocument, type NoteSummary } from "@oww/core";

export function toNoteSummary(note: AnyNoteDocument): NoteSummary {
  return {
    id: note.frontmatter.id,
    type: note.frontmatter.type,
    title: note.frontmatter.title,
    path: note.path,
    status: note.frontmatter.status,
    tags: note.frontmatter.tags,
    updatedAt: note.frontmatter.updatedAt
  };
}
