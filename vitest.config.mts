import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "file:./test.db";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "file:./test.db",
    },
  },
});
