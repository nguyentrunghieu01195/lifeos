import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response.
 * A full Content-Security-Policy (with per-request nonces) is introduced in the
 * hardening phase, once all asset origins (R2 public bucket, OAuth avatars) are known.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep node-only and native-binary packages out of the serverless bundle
  // graph — they are loaded from node_modules at runtime (Vercel's file
  // tracing copies them, including platform-specific .node binaries):
  // - "pg" is only used in local development (Neon driver in production)
  // - "@node-rs/argon2" ships N-API binaries that must not be bundled
  serverExternalPackages: ["pg", "@node-rs/argon2"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
