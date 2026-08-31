import { findRowAtOffset, rowOffsetPrefix, visibleRowRange } from './virtual-scroll-layout';

describe('virtual-scroll-layout', () => {
  it('builds prefix sums from measured heights and the estimate', () => {
    const prefix = rowOffsetPrefix(3, 96, [120, undefined, 80]);
    expect(prefix).toEqual([0, 120, 216, 296]);
  });

  it('finds the row for a pixel offset', () => {
    const prefix = rowOffsetPrefix(3, 96, [120, 200, 80]);
    expect(findRowAtOffset(prefix, 0, 3)).toBe(0);
    expect(findRowAtOffset(prefix, 119, 3)).toBe(0);
    expect(findRowAtOffset(prefix, 120, 3)).toBe(1);
    expect(findRowAtOffset(prefix, 319, 3)).toBe(1);
    expect(findRowAtOffset(prefix, 320, 3)).toBe(2);
  });

  it('returns a visible range that includes a taller row without using a uniform stride', () => {
    const prefix = rowOffsetPrefix(4, 96, [96, 96, 180, 96]);
    const range = visibleRowRange(192, 100, 0, 4, prefix);
    expect(range.start).toBe(2);
    expect(range.end).toBe(3);
  });
});
