/**
 * Mongo-style dates as returned on the wire (Extended JSON or plain ISO string).
 */
export type MongoDateJson =
  | string
  | number
  | Date
  | { $date: string | number | { $numberLong: string } };

/**
 * Epoch milliseconds for sorting / range checks, or `null` if missing or invalid.
 */
export function parseMongoDateToMs(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }

  if (typeof value === 'object' && value !== null && '$date' in value) {
    const inner = (value as { $date: unknown }).$date;
    if (typeof inner === 'string') {
      const t = Date.parse(inner);
      return Number.isNaN(t) ? null : t;
    }
    if (typeof inner === 'number' && Number.isFinite(inner)) {
      return inner;
    }
    if (typeof inner === 'object' && inner !== null && '$numberLong' in inner) {
      const n = Number((inner as { $numberLong: string }).$numberLong);
      return Number.isFinite(n) ? n : null;
    }
  }

  return null;
}
