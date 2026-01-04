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
  dateFrom?: string;
  dateTo?: string;
  showSort?: boolean;
  sortDirection?: SortDirection;
}

export interface FilterResult {
  searchText?: string;
  category?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortDirection?: SortDirection;
}

