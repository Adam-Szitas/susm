import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FileService } from '../../services/file.service';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environment';

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

@Component({
  selector: 'app-files',
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: './files.component.html',
  styleUrl: './files.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilesComponent implements OnInit {
  #fileService = inject(FileService);

  files = signal<FileWithContext[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Filter state
  searchText = signal('');
  selectedProject = signal<string>('');
  selectedCategory = signal<string>('');

  // Computed values
  projects = computed(() => {
    const allProjects = new Set<string>();
    this.files().forEach((f) => {
      if (f.project) {
        allProjects.add(f.project.id);
      }
    });
    return Array.from(allProjects).map((id) => {
      const file = this.files().find((f) => f.project?.id === id);
      return { id, name: file?.project?.name || 'Unknown' };
    });
  });

  categories = computed(() => {
    const allCategories = new Set<string>();
    this.files().forEach((f) => {
      if (f.file.category) {
        allCategories.add(f.file.category);
      }
    });
    return Array.from(allCategories).sort();
  });

  filteredFiles = computed(() => {
    let result = this.files();

    // Filter by search text
    const search = this.searchText().toLowerCase().trim();
    if (search) {
      result = result.filter((f) => {
        const filename = f.file.filename?.toLowerCase() || '';
        const description = f.file.description?.toLowerCase() || '';
        const projectName = f.project?.name.toLowerCase() || '';
        const objectStreet = f.object?.street?.toLowerCase() || '';
        const objectDesc = f.object?.description?.toLowerCase() || '';
        return (
          filename.includes(search) ||
          description.includes(search) ||
          projectName.includes(search) ||
          objectStreet.includes(search) ||
          objectDesc.includes(search)
        );
      });
    }

    // Filter by project
    if (this.selectedProject()) {
      result = result.filter((f) => f.project?.id === this.selectedProject());
    }

    // Filter by category
    if (this.selectedCategory()) {
      result = result.filter((f) => f.file.category === this.selectedCategory());
    }

    return result;
  });

  ngOnInit(): void {
    this.loadFiles();
  }

  loadFiles(): void {
    this.loading.set(true);
    this.error.set(null);

    this.#fileService.getAllFilesWithContext().subscribe({
      next: (files) => {
        this.files.set(files);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error.message || 'Failed to load files');
        this.loading.set(false);
      },
    });
  }

  getImageUrl(path: string): string {
    let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');

    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      const encodedPath = encodeURIComponent(normalizedPath);
      return `${environment.be}${environment.folderBase}/${encodedPath}`;
    }

    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring('uploads/'.length);
    }

    const pathSegments = normalizedPath.split('/').map((segment) => encodeURIComponent(segment));
    const encodedPath = pathSegments.join('/');
    return `${environment.be}${environment.folderBase}/${encodedPath}`;
  }

  clearFilters(): void {
    this.searchText.set('');
    this.selectedProject.set('');
    this.selectedCategory.set('');
  }
}

