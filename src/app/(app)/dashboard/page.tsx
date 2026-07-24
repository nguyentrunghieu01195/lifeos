import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Dashboard" };

function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? email[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

export default async function DashboardPage() {
  // Middleware already guards this route; this is defense in depth.
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, createdAt: true },
  });
  if (!user) {
    redirect("/login");
  }

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "there";
  const memberSince = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(user.createdAt);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">Your personal operating system is ready.</p>
      </header>

      <Card className="max-w-md glass">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Member since {memberSince}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-12">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{initialsOf(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user.name ?? "Unnamed"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Tasks, Calendar, Notes and the rest of your modules will appear here as they ship.
      </p>
    </div>
  );
}
