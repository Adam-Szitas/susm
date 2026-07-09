import type { ObjectAddress, ProjectAddress } from './user.model';

export interface FormatObjectAddressOptions {
  /** House number only (mobile compact cards). */
  compact?: boolean;
  includePostalCode?: boolean;
  separator?: string;
  fallback?: string;
}

type ObjectLabelSource = {
  address?: ObjectAddress | null;
  prefix?: string | null;
  _id?: { $oid?: string };
};

/** Formatted object address for cards, lists, and labels. */
export function formatObjectAddress(
  address?: ObjectAddress | null,
  options?: FormatObjectAddressOptions,
): string {
  if (!address) {
    return options?.fallback ?? '';
  }

  if (options?.compact) {
    return address.house_number?.trim() || options?.fallback || '';
  }

  const parts: string[] = [];
  if (address.house_number?.trim()) {
    parts.push(address.house_number.trim());
  }
  if (address.level?.trim()) {
    parts.push(address.level.trim());
  }
  if (address.door_number?.trim()) {
    parts.push(address.door_number.trim());
  }
  if (options?.includePostalCode && address.postal_code?.trim()) {
    parts.push(address.postal_code.trim());
  }

  const label = parts.join(options?.separator ?? ', ');
  return label || options?.fallback || '';
}

/** Address + optional prefix/id fallback (todo panels, protocol picker). */
export function formatObjectLabel(
  object: ObjectLabelSource,
  options?: FormatObjectAddressOptions & { usePrefixFallback?: boolean },
): string {
  const addressLabel = formatObjectAddress(object.address, options);
  if (addressLabel) {
    return addressLabel;
  }
  if (options?.usePrefixFallback !== false && object.prefix?.trim()) {
    return object.prefix.trim();
  }
  return object._id?.$oid || options?.fallback || '';
}

/** Display label for object cards with compact mode. */
export function formatObjectDisplayLabel(
  object: ObjectLabelSource,
  options?: FormatObjectAddressOptions & { compact?: boolean },
): string {
  const compact = options?.compact ?? false;
  const full = formatObjectAddress(object.address, { ...options, compact: false });
  const short = formatObjectAddress(object.address, { ...options, compact: true });
  return (
    (compact ? short || full : full || short) ||
    formatObjectLabel(object, { ...options, usePrefixFallback: false }) ||
    options?.fallback ||
    ''
  );
}

/** Lowercase search text for object address fields. */
export function objectAddressSearchText(address?: ObjectAddress | null): string {
  return [address?.house_number, address?.level, address?.door_number, address?.postal_code]
    .filter((part): part is string => !!part?.trim())
    .join(' ')
    .toLowerCase();
}

/** Non-empty project address lines for list cards. */
export function formatProjectAddressLines(address?: ProjectAddress | null): string[] {
  const lines: string[] = [];
  if (address?.street?.trim()) {
    lines.push(address.street.trim());
  }
  if (address?.postal_code?.trim()) {
    lines.push(address.postal_code.trim());
  }
  return lines;
}
