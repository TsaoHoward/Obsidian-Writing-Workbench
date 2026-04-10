import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { SearchService } from "@oww/search";
import { VaultAdapter } from "@oww/vault-adapter";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { loadMcpServerConfig } from "./config.js";
import { dispatchTool, toolDefinitions } from "./tools.js";

loadDotenv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

async function main() {
  const config = loadMcpServerConfig();
  const vaultAdapter = new VaultAdapter({ vaultRoot: config.vaultRoot });
  const searchService = new SearchService(vaultAdapter);

  const server = new Server(
    { name: "obsidian-writing-workbench", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    dispatchTool(request.params.name, request.params.arguments, { vaultAdapter, searchService })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // TODO: Add authenticated remote transport only after the local policy model is proven stable.
}

main().catch((error) => {
  console.error("MCP server failed to start.", error);
  process.exitCode = 1;
});
