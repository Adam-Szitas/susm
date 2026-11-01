/** Stored object prefix: `{basePrefix} {houseNumber}` when both are set. */
export function resolveObjectPrefix(
  basePrefix: string | null | undefined,
  houseNumber: string,
): string | null {
  const prefix = basePrefix?.trim() ?? '';
  const house = houseNumber?.trim() ?? '';

  if (!prefix) {
    return null;
  }
  if (!house) {
    return prefix;
  }
  return `${prefix} ${house}`;
}

/** Recover the shared prefix from the stored prefix and the object's house number. */
export function objectBasePrefix(prefix?: string | null, houseNumber?: string | null): string {
  const value = prefix?.trim() ?? '';
  const house = houseNumber?.trim() ?? '';
  const suffix = ` ${house}`;
  return house && value.endsWith(suffix) ? value.slice(0, -suffix.length).trim() : value;
}

export function matchesPrefixFilter(
  prefix: string | null | undefined,
  houseNumber: string | null | undefined,
  selected: string | null | undefined,
  exclude: boolean,
): boolean {
  if (!selected) return true;
  const matches = objectBasePrefix(prefix, houseNumber) === selected;
  return exclude ? !matches : matches;
}
