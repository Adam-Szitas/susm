export const MAX_HOUSE_NUMBER_RANGE_SIZE = 100;

export function buildHouseNumberRange(start: number, end: number): string[] {
  const from = Math.trunc(start);
  const to = Math.trunc(end);
  const step = from <= to ? 1 : -1;
  const values: string[] = [];

  for (let n = from; step > 0 ? n <= to : n >= to; n += step) {
    values.push(String(n));
  }

  return values;
}

export function parseHouseNumberBound(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}
