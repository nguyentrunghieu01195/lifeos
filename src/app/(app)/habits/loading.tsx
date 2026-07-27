import { Skeleton } from "@/components/ui/skeleton";

export default function HabitsLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
