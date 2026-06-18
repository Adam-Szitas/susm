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
