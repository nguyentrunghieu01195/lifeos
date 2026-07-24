import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration — no database adapter, no Node-only
 * dependencies. The middleware builds its lightweight auth check from this
 * object alone; src/lib/auth/index.ts extends it with the Prisma adapter and
 * the concrete providers for the Node runtime.
 *
 * Session strategy is JWT (see the Phase 2 notes in ARCHITECTURE.md):
 * required by the Credentials provider and lets the middleware authorize
 * requests without a database roundtrip.
 */
export const authConfig = {
  // Static process.env reference on purpose: the edge/middleware bundle only
  // exposes environment variables that are statically referenced, so relying
  // on Auth.js' internal dynamic lookup breaks session decoding when
  // self-hosting (`next start`).
  secret: process.env.AUTH_SECRET,
  // Required when self-hosting (`next start` behind any proxy): both the
  // middleware instance and the node instance must trust the incoming Host
  // header, otherwise session decoding fails with UntrustedHost.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/dashboard")) {
        // Returning false sends the visitor to pages.signIn with a callbackUrl.
        return isLoggedIn;
      }
      if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      // On sign-in the user object is present — persist the database id.
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
