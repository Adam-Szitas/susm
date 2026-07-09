import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { Filter, FilterResult, ObjectWithProject, objectAddressSearchText, parseDateValue } from '@models';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';
import { FilterComponent } from '../filter/filter.component';
import { FilterPersistenceService, PersistedFilterState } from '@services/filter-persistence.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { ObjectCardComponent } from '../shared/object-card.component';
import {
  VirtualScrollViewportComponent,
  VIRTUAL_SCROLL_DEFAULT_THRESHOLD,
} from '../shared/virtual-scroll-viewport.component';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

const FILTER_KEY = 'objects';

@Component({
  selector: 'app-object',
  templateUrl: './objects.component.html',
  styleUrl: './objects.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    FilterComponent,
    PageHeaderComponent,
    ObjectCardComponent,
    VirtualScrollViewportComponent,
    IconComponent,
  ],
})
export class ObjectComponent implements OnInit {
  protected readonly icons = icons;

  #projectStore = inject(ProjectStore);
  #filterPersistence = inject(FilterPersistenceService);
  readonly objectsFilter = viewChild(FilterComponent);
  public objects = this.#projectStore.objectsWithProjects;
  public filteredObjects = signal<ObjectWithProject[]>([]);
  #currentFilter = signal<FilterResult>({});
  #filtersVisible = false;
  filtersVisible = signal(false);
  restoredFilterState = signal<PersistedFilterState | null>(null);
  readonly virtualScrollThreshold = VIRTUAL_SCROLL_DEFAULT_THRESHOLD;
  /** Row height for virtual scroll; must fit tallest object card (incl. gap). */
  readonly objectCardItemSize = 260;

  readonly allCategories = computed(() => {
    const objects = this.objects() || [];
    const categories = new Set<string>();
    objects.forEach((item) => {
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

  trackObjectItemById = (_index: number, item: ObjectWithProject): string =>
    item.object?._id?.$oid ?? item.project_name;

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
      this.filtersVisible.set(restored.filtersVisible);
    } else {
      this.#currentFilter.set({});
    }
  }

  toggleFilters(): void {
    this.objectsFilter()?.toggleFilters();
  }

  public onFilterChange(filter: FilterResult): void {
    this.#currentFilter.set(filter);
    this.#filterPersistence.save(FILTER_KEY, { filter, filtersVisible: this.#filtersVisible });
  }

  public onFiltersVisibleChange(visible: boolean): void {
    this.#filtersVisible = visible;
    this.filtersVisible.set(visible);
    this.#filterPersistence.save(FILTER_KEY, { filter: this.#currentFilter(), filtersVisible: visible });
  }

  #applyFilters(objects: ObjectWithProject[], filter: FilterResult): ObjectWithProject[] {
    let filtered = [...objects];

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filtered = filtered.filter((item) => {
        const obj = item.object;
        if (!obj) return false;

        const addressText = objectAddressSearchText(obj.address);
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
      filtered = filtered.filter((item) => item.object?.category === filter.category);
    }

    if (filter.dateFrom || filter.dateTo) {
      filtered = filtered.filter((item) => {
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
