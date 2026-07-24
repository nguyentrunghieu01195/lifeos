import type { Metadata } from "next";
import Link from "next/link";

import { AuthSeparator } from "@/features/auth/components/auth-separator";
import { LoginForm } from "@/features/auth/components/login-form";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { getAvailableOAuthProviders } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

// Provider availability comes from runtime environment configuration.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const providers = getAvailableOAuthProviders();

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your LifeOS.</p>
      </header>

      {providers.length > 0 ? (
        <>
          <OAuthButtons providers={providers} />
          <AuthSeparator label="or continue with email" />
        </>
      ) : null}

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground">
        New to LifeOS?{" "}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
