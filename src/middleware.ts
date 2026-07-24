import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/config";

/**
 * Route protection at the edge. Built from the adapter-free config — the
 * `authorized` callback in src/lib/auth/config.ts decides:
 *  - /dashboard/** requires a session (redirects to /login with callbackUrl)
 *  - authenticated visitors on /login or /register go to /dashboard
 */
export default NextAuth(authConfig).auth;

export const config = {
  // Everything except Next internals, static assets and API routes
  // (the Auth.js handlers under /api/auth manage themselves).
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
