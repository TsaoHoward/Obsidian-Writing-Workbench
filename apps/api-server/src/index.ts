import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { loadApiServerConfig } from "./config.js";
import { buildServer } from "./server.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

async function main() {
  const config = loadApiServerConfig();
  const app = buildServer(config);

  await app.listen({
    host: config.host,
    port: config.port
  });
}

main().catch((error) => {
  console.error("API server failed to start.", error);
  process.exitCode = 1;
});
