import {
  Component,
  EventEmitter,
  input,
  Output,
  OnInit,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Filter, FilterResult, SortDirection } from '@models';
import { CommonModule } from '@angular/common';
import { PersistedFilterState } from '@services/filter-persistence.service';

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss',
})
export class FilterComponent implements OnInit {
  public filter = input.required<Filter>();
  public initialState = input<PersistedFilterState | null>();

  @Output()
  public filterChange = new EventEmitter<FilterResult>();

  @Output()
  public filtersVisibleChange = new EventEmitter<boolean>();

  private currentFilter = <FilterResult>({});
  public areFiltersVisible = false;
  /** Selected labels when `multiSelectCategories` is enabled (project tab file-group categories). */
  selectedFileGroupCategories: string[] = [];

  searchForm = new FormGroup({
    search: new FormControl(''),
    category: new FormControl(''),
    status: new FormControl(''),
    dateFrom: new FormControl(''),
    dateTo: new FormControl(''),
    sortDirection: new FormControl(''),
  });

  constructor() {
    // Emit search text immediately on change (with debounce)
    this.searchForm.get('search')?.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value: string | null) => {
        this.currentFilter = { ...this.currentFilter, searchText: value?.toString() };
        this.emitFilterChange()
      });

    // Emit immediately for category and date changes (single-select only — multi uses checkboxes)
    this.searchForm.get('category')?.valueChanges.subscribe((value) => {
      if (this.filter().multiSelectCategories) return;
      this.currentFilter = { ...this.currentFilter, category: value?.toString() };
      this.emitFilterChange();
    });
      
      this.searchForm.get('dateFrom')?.valueChanges
      .subscribe((value) => {
        this.currentFilter = { ...this.currentFilter, dateFrom: value?.toString() };
        this.emitFilterChange()
      });
      
      this.searchForm.get('dateTo')?.valueChanges
      .subscribe((value) => {
        this.currentFilter = { ...this.currentFilter, dateTo: value?.toString() };
        this.emitFilterChange()
      });
      this.searchForm.get('status')?.valueChanges
      .subscribe((value) => {
        this.currentFilter = { ...this.currentFilter, status: value?.toString() };
        this.emitFilterChange()
      });
      
      this.searchForm.get('sortDirection')?.valueChanges
      .subscribe((value) => {
        this.currentFilter = { ...this.currentFilter, sortDirection: (value?.toString() || '') as SortDirection };
        this.emitFilterChange()
      });
  }

  ngOnInit(): void {
    const filterData = this.filter();
    if (filterData.value) {
      this.searchForm.patchValue({ search: filterData.value });
    }
    if (filterData.selectedCategory) {
      this.searchForm.patchValue({ category: filterData.selectedCategory });
    }
    if (filterData.dateFrom) {
      this.searchForm.patchValue({ dateFrom: filterData.dateFrom });
    }
    if (filterData.dateTo) {
      this.searchForm.patchValue({ dateTo: filterData.dateTo });
    }
    if(filterData.statuses) {
      this.searchForm.patchValue({ status: filterData.selectedStatus });
    }
    if (filterData.sortDirection) {
      this.searchForm.patchValue({ sortDirection: filterData.sortDirection });
    }

    const restored = this.initialState();
    if (restored) {
      const f = restored.filter;
      this.searchForm.patchValue({
        search: f.searchText ?? '',
        category: f.category ?? '',
        status: f.status ?? '',
        dateFrom: f.dateFrom ?? '',
        dateTo: f.dateTo ?? '',
        sortDirection: f.sortDirection ?? '',
      });
      this.areFiltersVisible = restored.filtersVisible;
    }

    if (this.filter().multiSelectCategories) {
      const rf = restored?.filter;
      let initialCats: string[] = [];
      if (rf?.selectedCategories?.length) {
        initialCats = rf.selectedCategories.filter((c): c is string => !!c?.trim());
      } else if (rf?.category?.trim()) {
        initialCats = [rf.category.trim()];
      } else if (filterData.selectedCategories?.length) {
        initialCats = [...filterData.selectedCategories];
      }
      this.selectedFileGroupCategories = [...initialCats];
      this.currentFilter = {
        ...this.currentFilter,
        selectedCategories: [...this.selectedFileGroupCategories],
        category: undefined,
      };
      this.emitFilterChange();
    }
  }

  isMultiCategorySelected(category: string): boolean {
    return this.selectedFileGroupCategories.includes(category);
  }

  onMultiCategoryToggle(category: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedFileGroupCategories.includes(category)) {
        this.selectedFileGroupCategories = [...this.selectedFileGroupCategories, category];
      }
    } else {
      this.selectedFileGroupCategories = this.selectedFileGroupCategories.filter((c) => c !== category);
    }
    this.currentFilter = {
      ...this.currentFilter,
      selectedCategories: [...this.selectedFileGroupCategories],
      category: undefined,
    };
    this.emitFilterChange();
  }

  private emitFilterChange(): void {
    this.filterChange.emit(this.currentFilter);
  }

  toggleFilters(): void {
    this.areFiltersVisible = !this.areFiltersVisible;
    this.filtersVisibleChange.emit(this.areFiltersVisible);
  }

  clearFilters(): void {
    this.selectedFileGroupCategories = [];
    this.searchForm.reset(
      {
        search: '',
        category: '',
        status: '',
        dateFrom: '',
        dateTo: '',
        sortDirection: '',
      },
      { emitEvent: false },
    );
    const multi = this.filter().multiSelectCategories;
    this.currentFilter = {
      searchText: '',
      category: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      sortDirection: '' as SortDirection,
      ...(multi ? { selectedCategories: [] as string[] } : {}),
    };
    if (!multi) {
      delete this.currentFilter.selectedCategories;
    }
    this.emitFilterChange();
  }
}
