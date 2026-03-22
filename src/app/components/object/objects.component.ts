import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { DEFAULT_WORK_STATUS, Filter, FilterResult, formatWorkStatus, ObjectWithProject, parseDateValue } from '@models';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FilterComponent } from '../filter/filter.component';
import { StatusPillComponent } from '../status-pill/app-status-pill.component';
import { DatePipe } from '@angular/common';
import { FilterPersistenceService, PersistedFilterState } from '@services/filter-persistence.service';

const FILTER_KEY = 'objects';

@Component({
  selector: 'app-object',
  templateUrl: './objects.component.html',
  styleUrl: './objects.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, FilterComponent, StatusPillComponent, DatePipe],
})
export class ObjectComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  #filterPersistence = inject(FilterPersistenceService);
  public objects = this.#projectStore.objectsWithProjects;
  public filteredObjects = signal<ObjectWithProject[]>([]);
  #currentFilter = signal<FilterResult>({});
  #filtersVisible = false;
  restoredFilterState = signal<PersistedFilterState | null>(null);
  public readonly defaultStatus = DEFAULT_WORK_STATUS;
  public readonly formatStatus = formatWorkStatus;

  readonly allCategories = computed(() => {
    const objects = this.objects() || [];
    const categories = new Set<string>();
    objects.forEach(item => {
      if (item.object?.category) {
        categories.add(item.object.category);
      }
    });
    return Array.from(categories).sort();
  });

  constructor() {
    effect(() => {
      const objects = this.objects() || [];
      const appliedFilter = this.#currentFilter();
      this.filteredObjects.set(this.#applyFilters(objects, appliedFilter));
    });
  }

  filterData(): Filter {
    return {
      placeholder: 'common.search',
      value: '',
      label: 'common.search',
      showDateRange: true,
      showCategory: true,
      categories: this.allCategories(),
    };
  }

  public ngOnInit(): void {
    this.#projectStore.loadAllObjects();
    const restored = this.#filterPersistence.restore(FILTER_KEY);
    if (restored) {
      this.restoredFilterState.set(restored);
      this.#currentFilter.set(restored.filter);
      this.#filtersVisible = restored.filtersVisible;
    } else {
      this.#currentFilter.set({});
    }
  }

  public onFilterChange(filter: FilterResult): void {
    this.#currentFilter.set(filter);
    this.#filterPersistence.save(FILTER_KEY, { filter, filtersVisible: this.#filtersVisible });
  }

  public onFiltersVisibleChange(visible: boolean): void {
    this.#filtersVisible = visible;
    this.#filterPersistence.save(FILTER_KEY, { filter: this.#currentFilter(), filtersVisible: visible });
  }

  #applyFilters(objects: ObjectWithProject[], filter: FilterResult): ObjectWithProject[] {
    let filtered = [...objects];

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filtered = filtered.filter(item => {
        const obj = item.object;
        if (!obj) return false;

        const addr = obj.address;
        // ObjectAddress only has level, door_number, and postal_code (no street/house_number)
        const addressText = [
          addr?.level,
          addr?.door_number,
          addr?.postal_code,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const noteText = obj.note?.toLowerCase() ?? '';
        const projectName = item.project_name?.toLowerCase() ?? '';

        return (
          addressText.includes(searchLower) ||
          noteText.includes(searchLower) ||
          projectName.includes(searchLower)
        );
      });
    }

    if (filter.category) {
      filtered = filtered.filter(item => item.object?.category === filter.category);
    }

    if (filter.dateFrom || filter.dateTo) {
      filtered = filtered.filter(item => {
        const obj = item.object;
        if (!obj) return false;

        const objDate = parseDateValue(obj.createdAt ?? obj.created_at);
        if (!objDate) return false;

        if (filter.dateFrom) {
          const fromDate = new Date(filter.dateFrom);
          if (!Number.isNaN(fromDate.getTime()) && objDate < fromDate) return false;
        }
        if (filter.dateTo) {
          const toDate = new Date(filter.dateTo);
          if (!Number.isNaN(toDate.getTime())) {
            toDate.setHours(23, 59, 59, 999);
            if (objDate > toDate) return false;
          }
        }
        return true;
      });
    }

    return filtered;
  }
}
