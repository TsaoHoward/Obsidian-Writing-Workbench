import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["sandbox/smoke/**/*.smoke.test.ts"]
  }
});
