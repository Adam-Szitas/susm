import { matchesPrefixFilter, normalizeObjectPrefix, objectBasePrefix } from './object-prefix';

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

describe('objectBasePrefix', () => {
  it('groups legacy stored prefixes with different house numbers under the shared prefix', () => {
    expect(objectBasePrefix('Building A 1', '1')).toBe('Building A');
    expect(objectBasePrefix('Building A 100', '100')).toBe('Building A');
  });

  it('groups RH objects whether the house number was stored on the prefix or only on the address', () => {
    expect(objectBasePrefix('RH 110', '110')).toBe('RH');
    expect(objectBasePrefix('RH', '110')).toBe('RH');
    expect(matchesPrefixFilter('RH 110', '110', 'RH', false)).toBeTrue();
    expect(matchesPrefixFilter('RH', '110', 'RH', false)).toBeTrue();
    expect(matchesPrefixFilter('RH 111', '111', 'RH', false)).toBeTrue();
  });

  it('keeps standalone prefixes and does not remove a partial number', () => {
    expect(objectBasePrefix('Unit 12', '2')).toBe('Unit 12');
    expect(objectBasePrefix('Unit', '2')).toBe('Unit');
    expect(objectBasePrefix(null, '2')).toBe('');
  });
});

describe('matchesPrefixFilter', () => {
  it('includes or excludes a group and retains objects without prefixes when excluding', () => {
    expect(matchesPrefixFilter('A 1', '1', 'A', false)).toBeTrue();
    expect(matchesPrefixFilter('A 1', '1', 'A', true)).toBeFalse();
    expect(matchesPrefixFilter('B 2', '2', 'A', true)).toBeTrue();
    expect(matchesPrefixFilter(null, '3', 'A', true)).toBeTrue();
    expect(matchesPrefixFilter('A 1', '1', '', true)).toBeTrue();
  });
});
