import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedDevVault } from "../packages/vault-adapter/src/dev-vault.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function parseArgs(argv: string[]) {
  let vaultRoot = path.join(repoRoot, "sandbox", "dev-vault");
  let clean = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--clean") {
      clean = true;
      continue;
    }

    if (arg === "--vault-root") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--vault-root requires a path value.");
      }

      vaultRoot = path.resolve(repoRoot, next);
      index += 1;
    }
  }

  return { vaultRoot, clean };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await seedDevVault(options);

  console.log("Seeded dev vault.");
  console.log(`vaultRoot: ${result.vaultRoot}`);
  console.log(`folders: ${result.folderPaths.length}`);
  console.log(`notes: ${result.notePaths.length}`);
  console.log(`templates: ${result.templatePaths.length}`);
}

main().catch((error) => {
  console.error("Failed to seed dev vault.", error);
  process.exitCode = 1;
});
