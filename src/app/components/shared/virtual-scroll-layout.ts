/** Prefix[i] is the pixel offset of row i. Prefix[rowCount] is the total height. */
export function rowOffsetPrefix(
  rowCount: number,
  estimate: number,
  measured: Array<number | undefined>,
): number[] {
  const prefix = new Array<number>(rowCount + 1);
  prefix[0] = 0;
  for (let i = 0; i < rowCount; i++) {
    const height = measured[i];
    prefix[i + 1] = prefix[i] + (height && height > 0 ? height : estimate);
  }
  return prefix;
}

/** Largest row index whose offset is <= `offset`. */
export function findRowAtOffset(prefix: number[], offset: number, rowCount: number): number {
  if (rowCount <= 0) {
    return 0;
  }
  let lo = 0;
  let hi = rowCount;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((prefix[mid] ?? 0) <= offset) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return Math.min(rowCount - 1, Math.max(0, lo - 1));
}

export function visibleRowRange(
  scrollTop: number,
  viewportHeight: number,
  bufferPx: number,
  rowCount: number,
  prefix: number[],
): { start: number; end: number } {
  if (rowCount <= 0) {
    return { start: 0, end: 0 };
  }
  const start = findRowAtOffset(prefix, Math.max(0, scrollTop - bufferPx), rowCount);
  const endRow = findRowAtOffset(prefix, scrollTop + viewportHeight + bufferPx, rowCount);
  return { start, end: Math.min(rowCount, endRow + 1) };
}
