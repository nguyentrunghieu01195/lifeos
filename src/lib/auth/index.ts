import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { loginSchema } from "@/features/auth/schemas";
import { verifyUserCredentials } from "@/features/auth/server/service";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";

import { authConfig } from "./config";

/**
 * Full Auth.js instance for the Node runtime.
 *
 * The configuration is a *function* so that environment access and the Prisma
 * adapter are resolved per request — builds on machines without secrets never
 * execute them (ADR 0004). OAuth providers are only registered when their
 * credentials exist, so the UI never offers a dead sign-in button.
 */

export type OAuthProviderId = "google" | "github";

export function getAvailableOAuthProviders(): OAuthProviderId[] {
  const env = getEnv();
  const providers: OAuthProviderId[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) providers.push("github");
  return providers;
}

function buildProviders() {
  const env = getEnv();
  const providers = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHub({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      }),
    );
  }

  providers.push(
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }
        return verifyUserCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  );

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  adapter: PrismaAdapter(getDb()),
  providers: buildProviders(),
}));
