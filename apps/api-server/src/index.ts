import { loadApiServerConfig } from "./config.js";
import { buildServer } from "./server.js";

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
