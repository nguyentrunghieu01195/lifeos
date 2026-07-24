/**
 * Vitest stub for the "server-only" marker package. The real package throws
 * when imported outside a React Server Components environment; tests run in
 * plain Node, so we alias it to this empty module (see vitest.config.ts).
 */
export {};
