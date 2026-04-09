import path from "node:path";
import {
  PolicyViolationError,
  VaultPathError,
  canReadVaultPath,
  canWriteVaultPath,
  normalizeVaultPath,
  type FolderPolicy,
  v1FolderPolicy
} from "@oww/core";

function hasWindowsDrivePrefix(input: string): boolean {
  return /^[A-Za-z]:/.test(input);
}

export function ensureRelativeVaultPath(relativePath: string): string {
  if (relativePath.trim().length === 0) {
    throw new VaultPathError("Vault paths must not be empty.");
  }

  if (path.isAbsolute(relativePath) || hasWindowsDrivePrefix(relativePath)) {
    throw new VaultPathError("Vault paths must be relative to the configured vault root.", {
      relativePath
    });
  }

  const normalized = normalizeVaultPath(relativePath);
  const normalizedPosix = path.posix.normalize(normalized);

  if (
    normalizedPosix === "." ||
    normalizedPosix === ".." ||
    normalizedPosix.startsWith("../") ||
    normalizedPosix.includes("/../")
  ) {
    throw new VaultPathError("Vault paths must stay within the configured vault root.", {
      relativePath
    });
  }

  return normalizedPosix;
}

export function resolveVaultPath(vaultRoot: string, relativePath: string): {
  absolutePath: string;
  relativePath: string;
} {
  const safeRelativePath = ensureRelativeVaultPath(relativePath);
  const absoluteRoot = path.resolve(vaultRoot);
  const absolutePath = path.resolve(absoluteRoot, safeRelativePath);
  const relativeToRoot = path.relative(absoluteRoot, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new VaultPathError("Resolved path escaped the configured vault root.", {
      relativePath
    });
  }

  return {
    absolutePath,
    relativePath: safeRelativePath
  };
}

export function assertReadableVaultPath(
  relativePath: string,
  policy: FolderPolicy = v1FolderPolicy
): string {
  const safeRelativePath = ensureRelativeVaultPath(relativePath);

  if (!canReadVaultPath(safeRelativePath, policy)) {
    throw new PolicyViolationError("Read access is not allowed for this vault path.", {
      relativePath: safeRelativePath
    });
  }

  return safeRelativePath;
}

export function assertWritableVaultPath(
  relativePath: string,
  policy: FolderPolicy = v1FolderPolicy
): string {
  const safeRelativePath = ensureRelativeVaultPath(relativePath);

  if (!canWriteVaultPath(safeRelativePath, policy)) {
    throw new PolicyViolationError("Write access is not allowed for this vault path.", {
      relativePath: safeRelativePath
    });
  }

  return safeRelativePath;
}
