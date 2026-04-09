import { type AnyNoteDocument, type NoteKind, type NoteSummary } from "@oww/core";
import { toNoteSummary } from "@oww/note-schema";
import { VaultAdapter } from "@oww/vault-adapter";

export interface SkippedNote {
  path: string;
  reason: string;
}

export interface LoadNotesResult {
  notes: AnyNoteDocument[];
  skipped: SkippedNote[];
}

export interface ListNotesOptions {
  type?: NoteKind;
  limit?: number;
}

export interface SearchNotesOptions extends ListNotesOptions {
  query: string;
}

export interface SearchHit {
  note: NoteSummary;
  score: number;
}

export interface SearchNotesResult {
  hits: SearchHit[];
  skipped: SkippedNote[];
}

export class SearchService {
  constructor(private readonly vaultAdapter: VaultAdapter) {}

  async loadValidatedNotes(): Promise<LoadNotesResult> {
    const paths = await this.vaultAdapter.listReadableMarkdownFiles();
    const notes: AnyNoteDocument[] = [];
    const skipped: SkippedNote[] = [];

    for (const notePath of paths) {
      try {
        notes.push(await this.vaultAdapter.readValidatedNote(notePath));
      } catch (error) {
        skipped.push({
          path: notePath,
          reason: error instanceof Error ? error.message : "Unknown validation error"
        });
      }
    }

    return { notes, skipped };
  }

  async listNotes(options: ListNotesOptions = {}): Promise<{ notes: NoteSummary[]; skipped: SkippedNote[] }> {
    const { notes, skipped } = await this.loadValidatedNotes();
    const filtered = options.type ? notes.filter((note) => note.frontmatter.type === options.type) : notes;
    const limited = typeof options.limit === "number" ? filtered.slice(0, options.limit) : filtered;

    return {
      notes: limited.map(toNoteSummary),
      skipped
    };
  }

  async searchNotes(options: SearchNotesOptions): Promise<SearchNotesResult> {
    const normalizedQuery = options.query.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
      return {
        hits: [],
        skipped: []
      };
    }

    const { notes, skipped } = await this.loadValidatedNotes();
    const filtered = options.type ? notes.filter((note) => note.frontmatter.type === options.type) : notes;
    const hits = filtered
      .map((note) => ({
        note,
        score: scoreNote(note, normalizedQuery)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, options.limit ?? 20)
      .map((entry) => ({
        note: toNoteSummary(entry.note),
        score: entry.score
      }));

    return { hits, skipped };
  }
}

function scoreNote(note: AnyNoteDocument, normalizedQuery: string): number {
  const haystacks = [
    note.frontmatter.title,
    note.frontmatter.id,
    note.frontmatter.tags.join(" "),
    JSON.stringify(note.frontmatter),
    note.body
  ].map((value) => value.toLowerCase());

  let score = 0;

  for (const haystack of haystacks) {
    if (haystack.includes(normalizedQuery)) {
      score += 1;
    }
  }

  return score;
}

// TODO: Replace scan-on-every-request with an index-backed search pipeline in a future worker pass.
