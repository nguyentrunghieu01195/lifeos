import { Skeleton } from "@/components/ui/skeleton";

export default function ShoppingListLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="space-y-px">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
