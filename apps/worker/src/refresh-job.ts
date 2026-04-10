import { writeFile } from "node:fs/promises";
import { type SearchService } from "@oww/search";
import { type WorkerConfig } from "./config.js";

export type RefreshTrigger = "startup" | "interval" | "manual";

export interface WorkerRefreshSummary {
  event: "worker.refresh.completed";
  trigger: RefreshTrigger;
  totalNotes: number;
  byKind: Awaited<ReturnType<SearchService["getVaultStatus"]>>["byKind"];
  invalidCount: number;
  diagnostics: Awaited<ReturnType<SearchService["getVaultDiagnostics"]>>["summary"];
  skipped: Awaited<ReturnType<SearchService["getInvalidNotes"]>>["notes"];
  indexedAt: string;
}

export interface WorkerRefreshResult {
  summary: WorkerRefreshSummary;
  diagnosticsReport: Awaited<ReturnType<SearchService["getVaultDiagnostics"]>>;
  invalidReport: Awaited<ReturnType<SearchService["getInvalidNotes"]>>;
}

export async function runRefreshJob(
  searchService: SearchService,
  config: WorkerConfig,
  trigger: RefreshTrigger = "manual"
): Promise<WorkerRefreshResult> {
  const [status, invalid, diagnostics] = await Promise.all([
    searchService.getVaultStatus(),
    searchService.getInvalidNotes(),
    searchService.getVaultDiagnostics()
  ]);

  const result: WorkerRefreshResult = {
    summary: {
      event: "worker.refresh.completed",
      trigger,
      totalNotes: status.totalNotes,
      byKind: status.byKind,
      invalidCount: invalid.count,
      diagnostics: diagnostics.summary,
      skipped: invalid.notes,
      indexedAt: status.checkedAt
    },
    diagnosticsReport: diagnostics,
    invalidReport: invalid
  };

  console.log(JSON.stringify(result.summary, null, 2));

  if (config.indexPath) {
    try {
      await writeFile(config.indexPath, JSON.stringify(result, null, 2), "utf8");
    } catch (error) {
      console.error("Worker: failed to write index file.", error);
    }
  }

  return result;
}
