import type { Metadata } from "next";
import Link from "next/link";

import { AuthSeparator } from "@/features/auth/components/auth-separator";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getAvailableOAuthProviders } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

// Provider availability comes from runtime environment configuration.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const providers = getAvailableOAuthProviders();

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your LifeOS</h1>
        <p className="text-sm text-muted-foreground">
          One account for your tasks, notes, money and more.
        </p>
      </header>

      {providers.length > 0 ? (
        <>
          <OAuthButtons providers={providers} />
          <AuthSeparator label="or register with email" />
        </>
      ) : null}

      <RegisterForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
