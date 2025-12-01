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
}

export interface FilterResult {
  searchText?: string;
  category?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

