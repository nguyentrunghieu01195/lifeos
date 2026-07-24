import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Unit tests (src/**\/*.test.*) run everywhere with no external services.
 * Integration tests (src/**\/*.itest.*) additionally need DATABASE_URL and are
 * enabled with INTEGRATION=1 (pnpm test:integration) — locally against the
 * embedded Postgres, in CI against the job's Postgres service.
 */
const includeIntegration = process.env.INTEGRATION === "1";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // The real "server-only" package throws outside RSC environments.
      "server-only": fileURLToPath(new URL("./src/test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: includeIntegration ? ["src/**/*.{test,itest}.{ts,tsx}"] : ["src/**/*.test.{ts,tsx}"],
    globals: true,
    css: false,
  },
});
