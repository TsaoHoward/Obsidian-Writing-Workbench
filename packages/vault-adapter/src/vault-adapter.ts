import fs from "node:fs/promises";
import path from "node:path";
import {
  NoteValidationError,
  WorkbenchError,
  type AnyNoteDocument,
  type FolderPolicy,
  v1FolderPolicy
} from "@oww/core";
import { validateNoteDocument } from "@oww/note-schema";
import fg from "fast-glob";
import matter from "gray-matter";
import { assertReadableVaultPath, assertWritableVaultPath, resolveVaultPath } from "./path-guard.js";

export interface VaultAdapterOptions {
  vaultRoot: string;
  policy?: FolderPolicy;
}

export interface RawVaultNote {
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export class VaultAdapter {
  readonly vaultRoot: string;
  readonly policy: FolderPolicy;

  constructor(options: VaultAdapterOptions) {
    this.vaultRoot = path.resolve(options.vaultRoot);
    this.policy = options.policy ?? v1FolderPolicy;
  }

  getPolicy(): FolderPolicy {
    return this.policy;
  }

  async listReadableMarkdownFiles(): Promise<string[]> {
    const patterns = this.policy.readable.map((folder) => `${folder.replace(/\/$/, "")}/**/*.md`);
    const files = await fg(patterns, {
      cwd: this.vaultRoot,
      onlyFiles: true,
      unique: true
    });

    return files.map((filePath) => filePath.replace(/\\/g, "/")).sort();
  }

  async readRawNote(relativePath: string): Promise<RawVaultNote> {
    const safeRelativePath = assertReadableVaultPath(relativePath, this.policy);
    const { absolutePath } = resolveVaultPath(this.vaultRoot, safeRelativePath);

    try {
      const rawMarkdown = await fs.readFile(absolutePath, "utf8");
      const parsed = matter(rawMarkdown);

      return {
        path: safeRelativePath,
        frontmatter: parsed.data as Record<string, unknown>,
        body: parsed.content
      };
    } catch (error) {
      throw new WorkbenchError("Failed to read vault note.", "NOTE_READ_FAILED", {
        relativePath: safeRelativePath,
        cause: error
      });
    }
  }

  async readValidatedNote(relativePath: string): Promise<AnyNoteDocument> {
    const rawNote = await this.readRawNote(relativePath);

    try {
      return validateNoteDocument(rawNote);
    } catch (error) {
      throw new NoteValidationError("Vault note validation failed.", {
        relativePath: rawNote.path,
        cause: error
      });
    }
  }

  async writeValidatedNote(note: AnyNoteDocument): Promise<AnyNoteDocument> {
    const validatedNote = validateNoteDocument(note);
    const safeRelativePath = assertWritableVaultPath(validatedNote.path, this.policy);
    const { absolutePath } = resolveVaultPath(this.vaultRoot, safeRelativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    try {
      const markdown = matter.stringify(
        validatedNote.body,
        validatedNote.frontmatter as unknown as Record<string, unknown>
      );
      await fs.writeFile(absolutePath, markdown, "utf8");
      return validatedNote;
    } catch (error) {
      throw new WorkbenchError("Failed to write vault note.", "NOTE_WRITE_FAILED", {
        relativePath: safeRelativePath,
        cause: error
      });
    }
  }

  // TODO: Add explicit create-only and update-only modes once note identity rules are finalized.
  async upsertNote(note: AnyNoteDocument): Promise<AnyNoteDocument> {
    return this.writeValidatedNote(note);
  }

  // TODO: Delete, move, and rename are intentionally deferred and should remain disabled in v1.
}
