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
import { Filter, FilterResult } from '@models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-filter',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss',
})
export class FilterComponent implements OnInit {
  public filter = input.required<Filter>();

  @Output()
  public filterChange = new EventEmitter<FilterResult>();

  private currentFilter = <FilterResult>({});

  searchForm = new FormGroup({
    search: new FormControl(''),
    category: new FormControl(''),
    dateFrom: new FormControl(''),
    dateTo: new FormControl(''),
  });

  constructor() {
    // Emit search text immediately on change (with debounce)
    this.searchForm.get('search')?.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value: string | null) => {
        this.currentFilter = { ...this.currentFilter, searchText: value?.toString() };
        this.emitFilterChange()
      });

    // Emit immediately for category and date changes
    this.searchForm.get('category')?.valueChanges
      .subscribe((value) => {
        this.currentFilter = { ...this.currentFilter, category: value?.toString() };
        this.emitFilterChange()
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
  }

  private emitFilterChange(): void {
    this.filterChange.emit(this.currentFilter);
  }

  clearFilters(): void {
    this.searchForm.reset({
      search: '',
      category: '',
      dateFrom: '',
      dateTo: '',
    });
  }
}
