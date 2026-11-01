import { matchesPrefixFilter, objectBasePrefix, resolveObjectPrefix } from './object-prefix';

describe('objectBasePrefix', () => {
  it('groups stored prefixes with different house numbers under the shared prefix', () => {
    expect(objectBasePrefix(resolveObjectPrefix('Building A', '1'), '1')).toBe('Building A');
    expect(objectBasePrefix(resolveObjectPrefix('Building A', '100'), '100')).toBe('Building A');
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
