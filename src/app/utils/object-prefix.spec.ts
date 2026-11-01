import { objectBasePrefix, resolveObjectPrefix } from './object-prefix';

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
