import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FileService, type RemovedFileItem } from '../../services/file.service';
import { buildUploadImageUrl } from '../../utils/upload-image-url';
import { NotificationService } from '../../services/notification.service';
import { finalize } from 'rxjs';

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
  #notificationService = inject(NotificationService);
  #translate = inject(TranslateService);
  #failedImageKeys = new Set<string>();
  #failedImageKeysVersion = signal(0);

  removed = signal<RemovedFileItem[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  restoringIds = signal<Set<string>>(new Set());

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
    this.#failedImageKeys.add(`${item.kind}:${item.id}`);
    this.#failedImageKeysVersion.update((v) => v + 1);
  }

  showImage(item: RemovedFileItem): boolean {
    this.#failedImageKeysVersion(); // depend on signal so view updates when image errors
    return !!item.path && !this.#failedImageKeys.has(`${item.kind}:${item.id}`);
  }

  restore(item: RemovedFileItem): void {
    const key = `${item.kind}:${item.id}`;
    if (!item.id || this.restoringIds().has(key)) return;
    this.restoringIds.update((ids) => new Set(ids).add(key));
    this.#fileService
      .restoreRemovedItem(item)
      .pipe(
        finalize(() => {
          this.restoringIds.update((ids) => {
            const next = new Set(ids);
            next.delete(key);
            return next;
          });
        }),
      )
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(this.#translate.instant('files.restoreSuccess'));
          this.loadRemoved();
        },
        error: (err) => {
          this.#notificationService.showError(
            err?.message || this.#translate.instant('files.restoreFailed'),
          );
        },
      });
  }
}
