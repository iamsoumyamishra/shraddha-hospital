import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const aliases = { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) };
export default defineConfig({ test: { projects: [
  { resolve: { alias: aliases }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
  { resolve: { alias: aliases }, test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node", setupFiles: ["tests/setup.ts"], fileParallelism: false, testTimeout: 30000, hookTimeout: 30000 } },
] } });
