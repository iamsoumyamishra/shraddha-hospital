import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          root: ".",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            // `server-only` resolves to a stub that throws when it is not bundled
            // by the React Server Component compiler, which is exactly what a
            // Node test runner is. The guard has no meaning outside Next anyway.
            "server-only": fileURLToPath(
              new URL("./tests/stubs/server-only.ts", import.meta.url),
            ),
          },
        },
      },
      {
        test: {
          name: "integration",
          root: ".",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./tests/integration/setup.ts"],
          // Integration tests share one database, so they must not run concurrently.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            // `server-only` resolves to a stub that throws when it is not bundled
            // by the React Server Component compiler, which is exactly what a
            // Node test runner is. The guard has no meaning outside Next anyway.
            "server-only": fileURLToPath(
              new URL("./tests/stubs/server-only.ts", import.meta.url),
            ),
          },
        },
      },
    ],
  },
});