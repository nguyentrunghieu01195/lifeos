export type { ActionResult } from "@/types/actions";

export interface ShoppingListDto {
  id: string;
  name: string;
  description: string;
  totalItems: number;
  checkedItems: number;
  createdAt: string;
}

export interface ShoppingItemDto {
  id: string;
  listId: string;
  name: string;
  /** Decimal quantity as a number (e.g. 0.5, 1, 2.5). */
  quantity: number;
  unit: string;
  /** Estimated price in VND. Null if not set. */
  priceMinor: number | null;
  isChecked: boolean;
  sortOrder: number;
}

export interface ShoppingListDetailDto extends ShoppingListDto {
  items: ShoppingItemDto[];
  /** Sum of priceMinor for unchecked items that have a price set. */
  totalPriceMinor: number;
}

/** One AI-suggested item awaiting user review. */
export interface ItemSuggestionDto {
  name: string;
  quantity: number;
  unit: string;
}

/** Dashboard widget: up to 5 active lists with progress. */
export interface ShoppingDashboardDto {
  lists: Array<{
    id: string;
    name: string;
    totalItems: number;
    checkedItems: number;
  }>;
}
