export type SortDirection = 'asc' | 'desc' | '';

export interface Filter {
  placeholder: string;
  value: string;
  label: string;
  showDateRange?: boolean;
  showStatus?: boolean;
  statuses?: string[];
  selectedStatus?: string;
  showCategory?: boolean;
  categories?: string[];
  selectedCategory?: string;
  /** Multiple checkbox selection for categories (e.g. project tab — file group categories). */
  multiSelectCategories?: boolean;
  selectedCategories?: string[];
  dateFrom?: string;
  dateTo?: string;
  showSort?: boolean;
  sortDirection?: SortDirection;
}

export interface FilterResult {
  searchText?: string;
  category?: string;
  /** When set (non-empty), object list filters by file groups matching any of these labels. */
  selectedCategories?: string[];
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortDirection?: SortDirection;
}

/**
 * Parses a date value that may be a plain string, a timestamp number,
 * or a MongoDB Extended JSON object like `{"$date": {"$numberLong": "ms"}}`.
 */
export function parseDateValue(value: unknown): Date | null {
  if (!value) return null;

  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const $date = obj['$date'];
    if (typeof $date === 'string') return parseDateValue($date);
    if (typeof $date === 'object' && $date !== null) {
      const inner = $date as Record<string, unknown>;
      if (typeof inner['$numberLong'] === 'string') {
        return new Date(parseInt(inner['$numberLong'] as string, 10));
      }
    }
  }

  return null;
}

