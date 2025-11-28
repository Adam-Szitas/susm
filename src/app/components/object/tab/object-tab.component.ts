import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import QRCode from 'qrcode';
import { ProjectStore } from '@store/project.store';
import { ActivatedRoute, Router } from '@angular/router';
import { FileService } from '@services/file.service';
import { NotificationService } from '@services/notification.service';
import { Object, File as ProjectFile, DEFAULT_WORK_STATUS, formatWorkStatus, WORK_STATUSES } from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { FileListComponent } from '../../file-list/file-list.component';
import { HttpService } from '@services/http.service';

@Component({
  selector: 'app-object-tab',
  standalone: true,
  imports: [TranslateModule, FileListComponent],
  templateUrl: './object-tab.component.html',
  styleUrl: './object-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ObjectTabComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  #route = inject(ActivatedRoute);
  #router = inject(Router);
  #fileService = inject(FileService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #httpService = inject(HttpService);

  object = signal<Object | null>(null);
  files = signal<ProjectFile[]>([]);
  imagePreviewUrl = signal<string | null>(null);
  uploading = signal(false);
  shareUrl = signal<string | null>(null);
  shareQrDataUrl = signal<string | null>(null);
  shareLoading = signal(false);
  shareError = signal<string | null>(null);
  projectCategories = signal<string[]>([]);
  updatingCategory = signal(false);
  updatingStatus = signal(false);
  readonly defaultStatus = DEFAULT_WORK_STATUS;
  readonly formatStatus = formatWorkStatus;
  readonly statuses = WORK_STATUSES;

  ngOnInit(): void {
    const objectId = this.#route.snapshot.paramMap.get('id');

    if (objectId) {
      this.#projectStore.loadObject(objectId).subscribe({
        next: (object) => {
          this.object.set(object);
          this.shareUrl.set(null);
          this.shareQrDataUrl.set(null);
          this.shareError.set(null);
          this.loadFiles(objectId);
          this.loadProjectCategories(objectId);
        },
        error: () => {
          this.#notificationService.showError(
            this.#translationService.instant('errors.loadObjectFailed')
          );
          this.#router.navigate(['/']);
        },
      });
    } else {
      this.#router.navigate(['/']);
    }
  }

  private loadProjectCategories(objectId: string): void {
    // Get project categories from object's project
    this.#httpService.get<{ categories?: string[] }>(`object/${objectId}/project-categories`).subscribe({
      next: (result) => {
        this.projectCategories.set(result.categories || []);
      },
      error: () => {
        // Silently fail - categories are optional
        this.projectCategories.set([]);
      },
    });
  }

  updateCategory(category: string | null): void {
    const objectId = this.#route.snapshot.paramMap.get('id');
    if (!objectId) return;

    // Handle empty string as null
    const categoryValue = category === '' ? null : category;

    this.updatingCategory.set(true);
    this.#projectStore.updateObjectCategory(objectId, categoryValue).subscribe({
      next: (updatedObject) => {
        this.object.set(updatedObject);
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.categoryUpdated')
        );
        this.updatingCategory.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('objects.updateCategoryFailed')
        );
        this.updatingCategory.set(false);
      },
    });
  }

  updateStatus(status: string): void {
    const objectId = this.#route.snapshot.paramMap.get('id');
    if (!objectId) return;

    this.updatingStatus.set(true);
    this.#projectStore.updateObjectStatus(objectId, status).subscribe({
      next: (updatedObject) => {
        this.object.set(updatedObject);
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.statusUpdated')
        );
        this.updatingStatus.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('objects.updateStatusFailed')
        );
        this.updatingStatus.set(false);
      },
    });
  }

  private loadFiles(objectId: string): void {
    this.#fileService.getFilesForObject(objectId).subscribe({
      next: (files) => {
        const mappedFiles = files.map(file => ({
          ...file,
          filename: file.filename ||file.path.split(/[\\/]/).pop() || ''
        }));
        this.files.set(mappedFiles);
      },
      error: (error) => {
        console.error('Failed to load files:', error);
        this.files.set([]);
      },
    });
  }

  generateShareQr(): void {
    const objectId = this.object()?._id?.$oid;
    if (!objectId || this.shareLoading()) {
      return;
    }

    this.shareError.set(null);
    this.shareLoading.set(true);

    this.#httpService.post<{ token: string }>(`object/${objectId}/share`, {}).subscribe({
      next: ({ token }) => {
        const url = `${window.location.origin}/share/${token}`;
        this.shareUrl.set(url);
        QRCode.toDataURL(url, { width: 256, margin: 1 })
          .then((dataUrl: string) => {
            this.shareQrDataUrl.set(dataUrl);
            this.shareLoading.set(false);
          })
          .catch(() => {
            this.shareError.set(this.#translationService.instant('objects.qrError'));
            this.shareLoading.set(false);
          });
      },
      error: (error) => {
        this.shareError.set(
          error.message || this.#translationService.instant('objects.qrError')
        );
        this.shareLoading.set(false);
      },
    });
  }

  copyShareLink(): void {
    const url = this.shareUrl();
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
    if (!url || !clipboard) return;

    clipboard
      .writeText(url)
      .then(() => this.#notificationService.showSuccess('objects.linkCopied'))
      .catch(() => this.#notificationService.showError('objects.qrError'));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.imageFileRequired')
      );
      this.imagePreviewUrl.set(null);
      input.value = '';
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.imagePreviewUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    const objectId = this.#route.snapshot.paramMap.get('id');
    if (!objectId) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.objectIdNotFound')
      );
      return;
    }

    this.uploadFile(file, objectId);
  }

  private uploadFile(file: File, objectId: string): void {
    this.uploading.set(true);

    const form = new FormData();
    form.append('avatar', file, file.name);

    this.#fileService.uploadFileForObject(form, objectId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.uploadSuccess')
        );
        this.uploading.set(false);
        // Reload the object and files to get updated file list
        this.#projectStore.loadObject(objectId).subscribe({
          next: (object) => {
            this.object.set(object);
            this.loadFiles(objectId);
            this.uploading.set(false);
            this.imagePreviewUrl.set(null);
          },
        });
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('errors.uploadFailed')
        );
        this.uploading.set(false);
        this.imagePreviewUrl.set(null);
      },
    });
  }
}
