import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import QRCode from 'qrcode';
import { ProjectStore } from '@store/project.store';
import { ActivatedRoute, Router } from '@angular/router';
import { FileService } from '@services/file.service';
import { NotificationService } from '@services/notification.service';
import { Object, FileGroup, DEFAULT_WORK_STATUS, formatWorkStatus, WORK_STATUSES } from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { FileListComponent } from '../../file-list/file-list.component';
import { HttpService } from '@services/http.service';
import { StatusPillComponent } from '../../status-pill/app-status-pill.component';
import { environment } from '../../../environment';
import { FileUploadModalComponent } from '../../file-upload-modal/file-upload-modal.component';
import { ModalService } from '@services/modal.service';
import { EditObjectComponent } from '../edit-object/object-edit.component';
@Component({
  selector: 'app-object-tab',
  standalone: true,
  imports: [TranslateModule, FileListComponent, StatusPillComponent, FileUploadModalComponent],
  templateUrl: './object-tab.component.html',
  styleUrl: './object-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectTabComponent implements OnInit {
  #projectStore = inject(ProjectStore);
  #route = inject(ActivatedRoute);
  #router = inject(Router);
  #fileService = inject(FileService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #httpService = inject(HttpService);
  #modalService = inject(ModalService);

  object = signal<Object | null>(null);
  fileGroups = signal<FileGroup[]>([]);
  imagePreviewUrl = signal<string | null>(null);
  uploading = signal(false);
  shareUrl = signal<string | null>(null);
  shareQrDataUrl = signal<string | null>(null);
  shareLoading = signal(false);
  shareError = signal<string | null>(null);
  projectCategories = signal<string[]>([]);
  updatingCategory = signal(false);
  updatingStatus = signal(false);
  uploadModalOpen = signal(false);
  selectedFiles = signal<globalThis.File[]>([]);
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
            this.#translationService.instant('errors.loadObjectFailed'),
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
    this.#httpService
      .get<{ categories?: string[] }>(`object/${objectId}/project-categories`)
      .subscribe({
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
          this.#translationService.instant('objects.categoryUpdated'),
        );
        this.updatingCategory.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('objects.updateCategoryFailed'),
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
          this.#translationService.instant('objects.statusUpdated'),
        );
        this.updatingStatus.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('objects.updateStatusFailed'),
        );
        this.updatingStatus.set(false);
      },
    });
  }

  private loadFiles(objectId: string): void {
    this.#fileService.getFilesForObject(objectId).subscribe({
      next: (fileGroups) => {
        const refactoredFileGroups = fileGroups.map((fileGroup) => {
          return {
            ...fileGroup,
            files: fileGroup.files.map((file) => {
              return {
                ...file,
                filename: file.filename.split('\\')[file.filename.split('\\').length - 1],
              };
            }),
          };
        });
        this.fileGroups.set(refactoredFileGroups);
      },
      error: (error) => {
        console.error('Failed to load file groups:', error);
        this.fileGroups.set([]);
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
        // Use Router to create the proper URL that respects base href and routing
        const urlTree = this.#router.createUrlTree(['/share', token]);
        const relativeUrl = this.#router.serializeUrl(urlTree);
        // Use environment.frontend for the base URL, which handles proxy/cluster scenarios
        // Fallback to window.location.origin if environment.frontend is not set
        const baseUrl =
          environment.frontend || (typeof window !== 'undefined' ? window.location.origin : '');
        const absoluteUrl = new URL(relativeUrl, baseUrl).href;
        this.shareUrl.set(absoluteUrl);
        QRCode.toDataURL(absoluteUrl, { width: 256, margin: 1 })
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
        this.shareError.set(error.message || this.#translationService.instant('objects.qrError'));
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

  openUploadModal(): void {
    this.uploadModalOpen.set(true);
    this.selectedFiles.set([]);
  }

  onFilesSelected(files: globalThis.File[]): void {
    this.selectedFiles.set(files);
  }

  onUploadFile(data: { files: globalThis.File[]; description: string; category: string }): void {
    const objectId = this.#route.snapshot.paramMap.get('id');
    if (!objectId) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.objectIdNotFound'),
      );
      this.uploadModalOpen.set(false);
      return;
    }

    this.uploadFiles(data.files, data.description, data.category, objectId);
  }

  onCancelUpload(): void {
    this.uploadModalOpen.set(false);
    this.selectedFiles.set([]);
    this.imagePreviewUrl.set(null);
  }

  private uploadFiles(
    files: globalThis.File[],
    description: string,
    category: string,
    objectId: string,
  ): void {
    this.uploading.set(true);

    const form = new FormData();

    // Append all files with the same field name (backend will process all)
    files.forEach((file) => {
      form.append('avatar', file, file.name);
    });

    if (description) {
      form.append('description', description);
    }
    if (category) {
      form.append('category', category);
    }

    this.#fileService.uploadFileForObject(form, objectId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.uploadSuccess'),
        );
        this.uploading.set(false);
        this.uploadModalOpen.set(false);
        this.selectedFiles.set([]);
        this.imagePreviewUrl.set(null);
        // Reload the object and files to get updated file list
        this.#projectStore.loadObject(objectId).subscribe({
          next: (object) => {
            this.object.set(object);
            this.loadFiles(objectId);
          },
        });
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('errors.uploadFailed'),
        );
        this.uploading.set(false);
      },
    });
  }

  onFileDeleted(): void {
    const objectId = this.object()?._id?.$oid;
    if (objectId) {
      this.loadFiles(objectId);
    }
  }

  editObjectDetails(): void {
    this.#modalService.open({
      title: 'objects.editObject',
      component: EditObjectComponent,
      componentInputs: {
        objectData: this.object(),
      },
    });
  }
}
