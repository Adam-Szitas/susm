import { matchesPrefixFilter, normalizeObjectPrefix } from './object-prefix';

describe('normalizeObjectPrefix', () => {
  it('saves exactly the prefix the user typed, never the house number', () => {
    expect(normalizeObjectPrefix('RH')).toBe('RH');
    expect(normalizeObjectPrefix('  RH  ')).toBe('RH');
    expect(normalizeObjectPrefix('WH Stg. 1')).toBe('WH Stg. 1');
  });

  it('stores no prefix when the field is empty', () => {
    expect(normalizeObjectPrefix('')).toBeNull();
    expect(normalizeObjectPrefix('   ')).toBeNull();
    expect(normalizeObjectPrefix(null)).toBeNull();
    expect(normalizeObjectPrefix(undefined)).toBeNull();
  });
});

describe('matchesPrefixFilter', () => {
  it('matches the stored prefix exactly, without cutting the house number or trimming', () => {
    expect(matchesPrefixFilter('WH 3', 'WH 3', false)).toBeTrue();
    expect(matchesPrefixFilter('WH 3', 'WH', false)).toBeFalse();
    expect(matchesPrefixFilter('WH', 'WH 3', false)).toBeFalse();
    expect(matchesPrefixFilter('WH ', 'WH', false)).toBeFalse();
  });

  it('includes or excludes a prefix and retains objects without prefixes when excluding', () => {
    expect(matchesPrefixFilter('A', 'A', false)).toBeTrue();
    expect(matchesPrefixFilter('A', 'A', true)).toBeFalse();
    expect(matchesPrefixFilter('B', 'A', true)).toBeTrue();
    expect(matchesPrefixFilter(null, 'A', true)).toBeTrue();
    expect(matchesPrefixFilter('A', '', true)).toBeTrue();
  });
});
