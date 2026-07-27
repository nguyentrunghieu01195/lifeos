import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DocumentsView } from "@/features/documents/components/documents-view";
import { listDocuments, purgeStalePending } from "@/features/documents/server/service";
import { getSessionUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  // Sweep abandoned uploads before listing so junk rows never accumulate.
  await purgeStalePending(userId);
  const documents = await listDocuments(userId);

  return <DocumentsView initialDocuments={documents} />;
}
