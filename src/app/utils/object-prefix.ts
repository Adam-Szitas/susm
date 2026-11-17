/** Prefix saved on a new object: exactly what the user typed, trimmed; empty → none. */
export function normalizeObjectPrefix(prefix: string | null | undefined): string | null {
  return prefix?.trim() || null;
}

/** Prefix filter: the object's stored prefix must equal the selected chip exactly. */
export function matchesPrefixFilter(
  prefix: string | null | undefined,
  selected: string | null | undefined,
  exclude: boolean,
): boolean {
  if (!selected) return true;
  const matches = prefix === selected;
  return exclude ? !matches : matches;
}
