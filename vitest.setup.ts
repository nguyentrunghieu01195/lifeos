import { loadEnvConfig } from "@next/env";

import "@testing-library/jest-dom/vitest";

// Load .env files the same way Next.js does (integration tests need
// DATABASE_URL; unit tests must not depend on any of these values).
loadEnvConfig(process.cwd());
