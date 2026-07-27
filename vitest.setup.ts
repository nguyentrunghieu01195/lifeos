import { loadEnvConfig } from "@next/env";

import "@testing-library/jest-dom/vitest";

// Load .env files the same way Next.js does (integration tests need
// DATABASE_URL; unit tests must not depend on any of these values).
loadEnvConfig(process.cwd());

// jsdom lacks matchMedia; next-themes and responsive hooks need it.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
