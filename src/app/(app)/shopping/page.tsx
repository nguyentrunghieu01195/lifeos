import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ShoppingListsView } from "@/features/shopping/components/shopping-lists-view";
import { listShoppingLists } from "@/features/shopping/server/service";
import { getSessionUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Shopping" };

export default async function ShoppingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const lists = await listShoppingLists(userId);
  return <ShoppingListsView lists={lists} />;
}
