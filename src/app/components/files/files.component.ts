import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FileService,
  FileWithContext,
  PaginatedPicturesResponse,
} from '../../services/file.service';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Filter, FilterResult } from '@models';
import { FilterComponent } from '../filter/filter.component';
import { FilterPersistenceService, PersistedFilterState } from '@services/filter-persistence.service';
import { buildUploadImageUrl } from '../../utils/upload-image-url';

const FILTER_KEY = 'files';
const PICTURES_PAGE_SIZE = 50;

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, FilterComponent, RouterLink],
  templateUrl: './files.component.html',
  styleUrl: './files.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilesComponent implements OnInit {
  #fileService = inject(FileService);
  #router = inject(Router);
  #filterPersistence = inject(FilterPersistenceService);

  files = signal<FileWithContext[]>([]);
  loading = signal(false);
  pageLoading = signal(false);
  error = signal<string | null>(null);

  #failedFileIds = new Set<string>();
  #failedFileIdsVersion = signal(0);

  selectedProject = signal<string>('');
  #currentFilter = signal<FilterResult>({});
  #filtersVisible = false;
  restoredFilterState = signal<PersistedFilterState | null>(null);
  readonly pageSize = PICTURES_PAGE_SIZE;
  currentPage = signal(1);
  totalFileCount = signal(0);
  totalPages = signal(1);
  projects = signal<{ id: string; name: string }[]>([]);
  categories = signal<string[]>([]);

  pageRange = computed(() => {
    const total = this.totalFileCount();
    if (total === 0) {
      return { from: 0, to: 0, total: 0 };
    }
    const page = this.currentPage();
    const from = (page - 1) * this.pageSize + 1;
    const to = Math.min(page * this.pageSize, total);
    return { from, to, total };
  });

  ngOnInit(): void {
    const restored = this.#filterPersistence.restore(FILTER_KEY);
    if (restored) {
      this.restoredFilterState.set(restored);
      this.#currentFilter.set(restored.filter);
      this.#filtersVisible = restored.filtersVisible;
    }
    this.loadPage(1, true);
  }

  loadPage(page: number, initial = false): void {
    if (initial) {
      this.loading.set(true);
    } else {
      this.pageLoading.set(true);
    }
    this.error.set(null);
    this.#failedFileIds.clear();
    this.#failedFileIdsVersion.update((v) => v + 1);

    const filter = this.#currentFilter();
    this.#fileService
      .getPicturesPage({
        page,
        limit: this.pageSize,
        search: filter.searchText,
        category: filter.category,
        project_id: this.selectedProject() || undefined,
        date_from: filter.dateFrom,
        date_to: filter.dateTo,
      })
      .subscribe({
        next: (response) => this.#applyPageResponse(response),
        error: (err) => {
          this.error.set(err.message || 'Failed to load pictures');
          this.loading.set(false);
          this.pageLoading.set(false);
        },
      });
  }

  #applyPageResponse(response: PaginatedPicturesResponse): void {
    this.files.set(Array.isArray(response.items) ? response.items : []);
    this.totalFileCount.set(response.total ?? 0);
    this.totalPages.set(Math.max(1, response.total_pages ?? 1));
    this.currentPage.set(response.page ?? 1);
    this.projects.set(Array.isArray(response.projects) ? response.projects : []);
    this.categories.set(Array.isArray(response.categories) ? response.categories : []);
    this.loading.set(false);
    this.pageLoading.set(false);
  }

  getImageUrl(path: string): string {
    return buildUploadImageUrl(path);
  }

  hasImageFailed(fileWithContext: FileWithContext): boolean {
    this.#failedFileIdsVersion();
    const id = fileWithContext?.file?._id?.$oid;
    return !!id && this.#failedFileIds.has(id);
  }

  onImageError(fileWithContext: FileWithContext): void {
    const id = fileWithContext?.file?._id?.$oid;
    if (id) {
      this.#failedFileIds.add(id);
      this.#failedFileIdsVersion.update((v) => v + 1);
    }
  }

  filterData(): Filter {
    return {
      placeholder: 'common.search',
      value: '',
      label: 'common.search',
      showDateRange: true,
      showCategory: this.categories().length > 0,
      categories: this.categories(),
    };
  }

  onFilterChange(filter: FilterResult): void {
    this.#currentFilter.set(filter);
    this.#filterPersistence.save(FILTER_KEY, { filter, filtersVisible: this.#filtersVisible });
    this.currentPage.set(1);
    this.loadPage(1);
  }

  onFiltersVisibleChange(visible: boolean): void {
    this.#filtersVisible = visible;
    this.#filterPersistence.save(FILTER_KEY, { filter: this.#currentFilter(), filtersVisible: visible });
  }

  onProjectFilterChange(projectId: string): void {
    this.selectedProject.set(projectId);
    this.currentPage.set(1);
    this.loadPage(1);
  }

  goToPreviousPage(): void {
    const nextPage = Math.max(1, this.currentPage() - 1);
    if (nextPage === this.currentPage()) {
      return;
    }
    this.currentPage.set(nextPage);
    this.loadPage(nextPage);
  }

  goToNextPage(): void {
    const nextPage = Math.min(this.totalPages(), this.currentPage() + 1);
    if (nextPage === this.currentPage()) {
      return;
    }
    this.currentPage.set(nextPage);
    this.loadPage(nextPage);
  }

  onFileClick(fileWithContext: FileWithContext): void {
    if (fileWithContext.object?.id) {
      this.#router.navigate(['/objects/tab', fileWithContext.object.id]);
    } else if (fileWithContext.project?.id) {
      this.#router.navigate(['/projects/tab', fileWithContext.project.id]);
    }
  }
}
