import {
  formatObjectAddress,
  formatObjectDisplayLabel,
  formatObjectLabel,
  formatProjectAddressLines,
  objectAddressSearchText,
} from './object-address.util';

describe('object-address.util', () => {
  describe('formatObjectAddress', () => {
    it('returns empty string when address is missing', () => {
      expect(formatObjectAddress(null)).toBe('');
      expect(formatObjectAddress(undefined, { fallback: 'n/a' })).toBe('n/a');
    });

    it('formats full address parts', () => {
      expect(
        formatObjectAddress({
          house_number: '12',
          level: '2',
          door_number: 'A',
        }),
      ).toBe('12, 2, A');
    });

    it('formats compact house number only', () => {
      expect(
        formatObjectAddress(
          { house_number: '12', level: '2', door_number: 'A' },
          { compact: true },
        ),
      ).toBe('12');
    });

    it('includes postal code when requested', () => {
      expect(
        formatObjectAddress(
          { house_number: '12', postal_code: '1010' },
          { includePostalCode: true },
        ),
      ).toBe('12, 1010');
    });
  });

  describe('formatObjectLabel', () => {
    it('prefers address over prefix', () => {
      expect(
        formatObjectLabel({
          address: { house_number: '5' },
          prefix: 'Unit',
        }),
      ).toBe('5');
    });

    it('falls back to prefix then id', () => {
      expect(formatObjectLabel({ prefix: 'Unit' })).toBe('Unit');
      expect(formatObjectLabel({ _id: { $oid: 'abc123' } })).toBe('abc123');
    });
  });

  describe('formatObjectDisplayLabel', () => {
    it('uses compact label in compact mode', () => {
      expect(
        formatObjectDisplayLabel(
          { address: { house_number: '12', level: '1' } },
          { compact: true },
        ),
      ).toBe('12');
    });

    it('uses full label in non-compact mode', () => {
      expect(
        formatObjectDisplayLabel(
          { address: { house_number: '12', level: '1' } },
          { compact: false },
        ),
      ).toBe('12, 1');
    });
  });

  describe('objectAddressSearchText', () => {
    it('joins address fields in lowercase', () => {
      expect(
        objectAddressSearchText({
          house_number: '12',
          level: '2',
          door_number: 'A',
          postal_code: '1010',
        }),
      ).toBe('12 2 a 1010');
    });
  });

  describe('formatProjectAddressLines', () => {
    it('returns street and postal code lines', () => {
      expect(
        formatProjectAddressLines({
          street: 'Main St',
          postal_code: '1010',
        }),
      ).toEqual(['Main St', '1010']);
    });

    it('omits blank lines', () => {
      expect(formatProjectAddressLines({ street: ' ', postal_code: '' })).toEqual([]);
    });
  });
});
