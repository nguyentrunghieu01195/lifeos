import { cn } from "@/lib/utils";

/** The LifeOS orbit mark + wordmark. */
export function Logo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 64 64" aria-hidden className="size-6 shrink-0">
        <defs>
          <linearGradient id="lifeos-logo-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#lifeos-logo-gradient)" />
        <circle cx="32" cy="32" r="13" fill="none" stroke="#fff" strokeWidth="4" />
        <circle cx="45.5" cy="18.5" r="5" fill="#fff" />
      </svg>
      {withWordmark ? <span>LifeOS</span> : null}
    </span>
  );
}
