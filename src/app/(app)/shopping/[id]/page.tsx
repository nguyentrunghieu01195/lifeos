import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ShoppingListView } from "@/features/shopping/components/shopping-list-view";
import { getShoppingList } from "@/features/shopping/server/service";
import { isAppError } from "@/lib/errors";
import { getSessionUserId } from "@/lib/auth";

interface ShoppingListPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ShoppingListPageProps): Promise<Metadata> {
  const userId = await getSessionUserId();
  if (!userId) return { title: "Shopping" };
  const { id } = await params;
  try {
    const list = await getShoppingList(userId, id);
    return { title: list.name };
  } catch {
    return { title: "Shopping" };
  }
}

export default async function ShoppingListPage({ params }: ShoppingListPageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  let list;
  try {
    list = await getShoppingList(userId, id);
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }

  return <ShoppingListView list={list} />;
}
