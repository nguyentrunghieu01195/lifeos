/** Labeled horizontal rule used between OAuth buttons and the email form. */
export function AuthSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground uppercase">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
