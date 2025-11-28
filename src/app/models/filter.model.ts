export interface Filter {
  placeholder: string;
  value: string;
  label: string;
  showDateRange?: boolean;
  showCategory?: boolean;
  categories?: string[];
  selectedCategory?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FilterResult {
  searchText?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
}

