export interface FolderPolicy {
  readable: string[];
  writable: string[];
  protected: string[];
}

export const v1FolderPolicy: FolderPolicy = {
  readable: [
    "01 Topics/",
    "02 Sources/",
    "03 Claims/",
    "04 Outlines/",
    "05 Drafts/"
  ],
  writable: [
    "00 Inbox/AI/",
    "02 Sources/",
    "03 Claims/",
    "04 Outlines/",
    "05 Drafts/"
  ],
  protected: ["06 Finals/", "07 Templates/", "90 Archive/"]
};

export function normalizeVaultPath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/").replace(/\/$/, "");
}

function normalizeFolder(input: string): string {
  const normalized = normalizeVaultPath(input);
  return normalized.length === 0 ? normalized : `${normalized}/`;
}

function isWithinFolder(relativePath: string, folder: string): boolean {
  const normalizedPath = normalizeVaultPath(relativePath);
  const normalizedFolder = normalizeFolder(folder);
  return normalizedPath === normalizedFolder.slice(0, -1) || normalizedPath.startsWith(normalizedFolder);
}

export function isProtectedVaultPath(relativePath: string, policy: FolderPolicy = v1FolderPolicy): boolean {
  return policy.protected.some((folder) => isWithinFolder(relativePath, folder));
}

export function canReadVaultPath(relativePath: string, policy: FolderPolicy = v1FolderPolicy): boolean {
  if (isProtectedVaultPath(relativePath, policy)) {
    return false;
  }

  return policy.readable.some((folder) => isWithinFolder(relativePath, folder));
}

export function canWriteVaultPath(relativePath: string, policy: FolderPolicy = v1FolderPolicy): boolean {
  if (isProtectedVaultPath(relativePath, policy)) {
    return false;
  }

  return policy.writable.some((folder) => isWithinFolder(relativePath, folder));
}
