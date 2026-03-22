import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FileService } from '../../services/file.service';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../environment';
import { Filter, FilterResult, parseDateValue } from '@models';
import { FilterComponent } from '../filter/filter.component';
import { FilterPersistenceService, PersistedFilterState } from '@services/filter-persistence.service';

export interface FileWithContext {
  file: {
    _id: { $oid: string };
    path: string;
    filename: string;
    description?: string;
    category?: string;
    created_at: string;
  };
  project: {
    id: string;
    name: string;
  } | null;
  object: {
    id: string;
    street?: string;
    description?: string;
    house_number?: string;
  } | null;
}

const FILTER_KEY = 'files';

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
  error = signal<string | null>(null);

  #failedFileIds = new Set<string>();
  #failedFileIdsVersion = signal(0);

  selectedProject = signal<string>('');
  #currentFilter = signal<FilterResult>({});
  #filtersVisible = false;
  restoredFilterState = signal<PersistedFilterState | null>(null);

  // Exclude deleted and failed-to-load files from the list we work with
  #filesForDisplay = computed(() => {
    this.#failedFileIdsVersion();
    return this.files().filter((f) => {
      const id = f?.file?._id?.$oid;
      if (!id || this.#failedFileIds.has(id)) return false;
      if ((f.file as { deleted_at?: string })?.deleted_at) return false;
      if (!f.file?.path) return false;
      return true;
    });
  });

  // Computed values
  projects = computed(() => {
    const allProjects = new Set<string>();
    this.#filesForDisplay().forEach((f) => {
      if (f.project) {
        allProjects.add(f.project.id);
      }
    });
    return Array.from(allProjects).map((id) => {
      const file = this.#filesForDisplay().find((f) => f.project?.id === id);
      return { id, name: file?.project?.name || 'Unknown' };
    });
  });

  categories = computed(() => {
    const allCategories = new Set<string>();
    this.#filesForDisplay().forEach((f) => {
      if (f.file.category) {
        allCategories.add(f.file.category);
      }
    });
    return Array.from(allCategories).sort();
  });

  filteredFiles = computed(() => {
    const filter = this.#currentFilter();
    let result = this.#filesForDisplay();

    if (filter.searchText) {
      const search = filter.searchText.toLowerCase().trim();
      result = result.filter((f) => {
        const filename = f.file.filename?.toLowerCase() || '';
        const description = f.file.description?.toLowerCase() || '';
        const projectName = f.project?.name.toLowerCase() || '';
        // ObjectAddress doesn't have street, use project name instead
        const objectDesc = f.object?.description?.toLowerCase() || '';
        return (
          filename.includes(search) ||
          description.includes(search) ||
          projectName.includes(search) ||
          objectDesc.includes(search)
        );
      });
    }

    if (filter.category) {
      result = result.filter((f) => f.file.category === filter.category);
    }

    if (filter.dateFrom || filter.dateTo) {
      result = result.filter((f) => {
        const createdDate = parseDateValue(f.file.created_at);
        if (!createdDate) return false;

        if (filter.dateFrom) {
          const from = new Date(filter.dateFrom);
          if (!Number.isNaN(from.getTime()) && createdDate < from) return false;
        }

        if (filter.dateTo) {
          const to = new Date(filter.dateTo);
          if (!Number.isNaN(to.getTime())) {
            to.setHours(23, 59, 59, 999);
            if (createdDate > to) return false;
          }
        }

        return true;
      });
    }

    if (this.selectedProject()) {
      result = result.filter((f) => f.project?.id === this.selectedProject());
    }

    return result;
  });

  ngOnInit(): void {
    const restored = this.#filterPersistence.restore(FILTER_KEY);
    if (restored) {
      this.restoredFilterState.set(restored);
      this.#currentFilter.set(restored.filter);
      this.#filtersVisible = restored.filtersVisible;
    }
    this.loadFiles();
  }

  loadFiles(): void {
    this.loading.set(true);
    this.error.set(null);
    this.#failedFileIds.clear();

    this.#fileService.getAllFilesWithContext().subscribe({
      next: (files) => {
        this.files.set(Array.isArray(files) ? files : []);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error.message || 'Failed to load files');
        this.loading.set(false);
      },
    });
  }

  getImageUrl(path: string): string {
    if (!path || typeof path !== 'string') {
      return '';
    }
    // Normalize: strip leading . / and \, then backslashes to slashes (handles Windows paths)
    let normalizedPath = path.replace(/^[.\\/]+/, '').replace(/\\/g, '/');
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      return normalizedPath;
    }
    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring('uploads/'.length);
    }
    const pathSegments = normalizedPath.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment));
    const encodedPath = pathSegments.join('/');
    return `${environment.be}${environment.folderBase}/${encodedPath}`;
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
  }

  onFiltersVisibleChange(visible: boolean): void {
    this.#filtersVisible = visible;
    this.#filterPersistence.save(FILTER_KEY, { filter: this.#currentFilter(), filtersVisible: visible });
  }

  clearProjectFilter(): void {
    this.selectedProject.set('');
  }

  onFileClick(fileWithContext: FileWithContext): void {
    // If file belongs to an object, navigate to object page
    if (fileWithContext.object?.id) {
      this.#router.navigate(['/objects/tab', fileWithContext.object.id]);
    }
    // Otherwise, if file belongs to a project, navigate to project page
    else if (fileWithContext.project?.id) {
      this.#router.navigate(['/projects/tab', fileWithContext.project.id]);
    }
  }
}

