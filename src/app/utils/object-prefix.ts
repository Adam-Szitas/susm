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

/** Return the actual stored prefix used to identify an object in the project list. */
export function objectPrefixValue(prefix?: string | null): string {
  return prefix?.trim() ?? '';
}

export function matchesPrefixFilter(
  prefix: string | null | undefined,
  selected: string | null | undefined,
  exclude: boolean,
): boolean {
  if (!selected) return true;
  const matches = objectPrefixValue(prefix) === selected;
  return exclude ? !matches : matches;
}
