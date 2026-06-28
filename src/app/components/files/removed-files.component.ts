import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FileService } from '../../services/file.service';
import { buildUploadImageUrl } from '../../utils/upload-image-url';

export interface RemovedFileItem {
  object_name: string;
  filename: string;
  path?: string;
}

@Component({
  selector: 'app-removed-files',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink],
  templateUrl: './removed-files.component.html',
  styleUrl: './removed-files.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemovedFilesComponent implements OnInit {
  #fileService = inject(FileService);
  #failedImageKeys = new Set<string>();
  #failedImageKeysVersion = signal(0);

  removed = signal<RemovedFileItem[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRemoved();
  }

  loadRemoved(): void {
    this.loading.set(true);
    this.error.set(null);
    this.#fileService.getRemovedFiles().subscribe({
      next: (list) => {
        this.removed.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load removed files');
        this.loading.set(false);
      },
    });
  }

  getImageUrl(path: string | undefined): string {
    return buildUploadImageUrl(path);
  }

  onImageError(item: RemovedFileItem): void {
    this.#failedImageKeys.add(item.filename + item.object_name);
    this.#failedImageKeysVersion.update((v) => v + 1);
  }

  showImage(item: RemovedFileItem): boolean {
    this.#failedImageKeysVersion(); // depend on signal so view updates when image errors
    return !!item.path && !this.#failedImageKeys.has(item.filename + item.object_name);
  }
}
