/** Initials for avatar fallbacks: "Hieu Nguyen" -> "HN", null + email -> "H". */
export function initialsOf(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? email[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}
