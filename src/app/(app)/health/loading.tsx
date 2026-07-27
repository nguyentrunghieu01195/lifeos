import { Skeleton } from "@/components/ui/skeleton";

export default function HealthLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-44 flex-1" />
        <Skeleton className="h-44 flex-1" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
