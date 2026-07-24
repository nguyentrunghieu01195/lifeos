import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * The session exposed to the app always carries the database user id —
   * populated from the JWT in the session callback (src/lib/auth/config.ts).
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
