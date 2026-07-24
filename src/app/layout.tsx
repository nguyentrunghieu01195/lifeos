import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "LifeOS — One home for your whole life",
    template: "%s · LifeOS",
  },
  description:
    "LifeOS is a personal operating system powered by AI: tasks, calendar, notes, documents, finance, habits, health and a grounded AI assistant — together in one place.",
  applicationName: "LifeOS",
  openGraph: {
    type: "website",
    siteName: "LifeOS",
    title: "LifeOS — One home for your whole life",
    description:
      "A personal operating system powered by AI: tasks, calendar, notes, documents, finance, habits and more — together in one place.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "LifeOS — One home for your whole life",
    description:
      "A personal operating system powered by AI: tasks, calendar, notes, documents, finance, habits and more — together in one place.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster richColors position="top-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
