import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { DEFAULT_WORK_STATUS, Filter, FilterResult, formatWorkStatus, ObjectWithProject } from '@models';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FilterComponent } from '../filter/filter.component';
import { StatusPillComponent } from '../status-pill/app-status-pill.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-object',
  templateUrl: './objects.component.html',
  styleUrl: './objects.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, FilterComponent, StatusPillComponent, DatePipe],
})
export class ObjectComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  public objects = this.#projectStore.objectsWithProjects;
  public filteredObjects = signal<ObjectWithProject[]>([]);
  #currentFilter = signal<FilterResult>({});
  public readonly defaultStatus = DEFAULT_WORK_STATUS;
  public readonly formatStatus = formatWorkStatus;

  // Get all unique categories from all projects
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
    this.#currentFilter.set({});
  }

  public onFilterChange(filter: FilterResult): void {
    this.#currentFilter.set(filter);
  }

  #applyFilters(objects: ObjectWithProject[], filter: FilterResult): ObjectWithProject[] {
    let filtered = [...objects];

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filtered = filtered.filter(item => {
        const obj = item.object;
        if (!obj) return false;

        const addr = obj.address;
        const addressText = [
          addr?.street,
          addr?.house_number,
          addr?.level,
          addr?.door_number,
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

        // Support both createdAt (frontend model) and created_at (backend Mongo field)
        const createdRaw = obj.createdAt ?? obj.created_at;
        if (!createdRaw) return false;

        const objDate = new Date(createdRaw);
        if (Number.isNaN(objDate.getTime())) return false;

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
