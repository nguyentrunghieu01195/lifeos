import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="ml-auto h-9 w-40" />
      </div>
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-[28rem] w-full" />
    </div>
  );
}
