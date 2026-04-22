import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { BreadcrumbComponent, BreadcrumbItem } from '../../breadcrumb/breadcrumb.component';
import { UserStore } from '@store/user.store';

@Component({
  selector: 'app-object-tab',
  standalone: true,
  imports: [
    TranslateModule,
    FileListComponent,
    StatusPillComponent,
    FileUploadModalComponent,
    BreadcrumbComponent,
    FormsModule,
  ],
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
  #userStore = inject(UserStore);

  object = signal<Object | null>(null);
  isAdmin = this.#userStore.isAdmin;
  fileGroups = signal<FileGroup[]>([]);
  imagePreviewUrl = signal<string | null>(null);
  uploading = signal(false);
  deleting = signal(false);
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

  readonly breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const obj = this.object();
    const project = this.#projectStore.project();
    const objectsLabel = this.#translationService.instant('navbar.objects');
    const projectsLabel = this.#translationService.instant('navbar.projects');
    const objectLabel = this.#objectDisplayName(obj);

    if (!objectLabel) {
      return [{ label: objectsLabel, url: '/objects' }, { label: '…' }];
    }

    if (project?._id?.$oid && project?.name) {
      return [
        { label: projectsLabel, url: '/projects' },
        { label: project.name, url: `/projects/tab/${project._id.$oid}` },
        { label: objectLabel },
      ];
    }

    return [{ label: objectsLabel, url: '/objects' }, { label: objectLabel }];
  });

  readonly objectDisplayTitle = computed(() => this.#objectDisplayName(this.object()));

  /** Short display name for the object (e.g. address parts or "Object"). */
  #objectDisplayName(obj: Object | null): string {
    if (!obj?.address) return obj ? this.#translationService.instant('objects.title') : '';
    const a = obj.address;
    const parts = [a.house_number, a.level, a.door_number].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(', ') : this.#translationService.instant('objects.title');
  }

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
              // Ensure we always have a safe, normalized filename
              const rawName =
                file.filename || (file.path ? file.path.split(/[\\/]/).pop() || '' : '');
              const normalizedFilename = rawName.split('\\').pop() || rawName;
              return {
                ...file,
                filename: normalizedFilename,
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

  onUploadFile(data: {
    files: globalThis.File[];
    description: string;
    categories: string[];
    note: string;
  }): void {
    const objectId = this.#route.snapshot.paramMap.get('id');
    if (!objectId) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.objectIdNotFound'),
      );
      this.uploadModalOpen.set(false);
      return;
    }

    this.uploadFiles(data.files, data.description, data.categories, objectId, data.note);
  }

  onCancelUpload(): void {
    this.uploadModalOpen.set(false);
    this.selectedFiles.set([]);
    this.imagePreviewUrl.set(null);
  }

  private uploadFiles(
    files: globalThis.File[],
    description: string,
    categories: string[],
    objectId: string,
    note?: string,
  ): void {
    this.uploading.set(true);

    const form = new FormData();

    files.forEach((file) => {
      form.append('avatar', file, file.name);
    });

    if (description) {
      form.append('description', description);
    }
    if (categories.length > 0) {
      const unique = [...new Set(categories.map((c) => c.trim()).filter(Boolean))];
      if (unique.length > 0) {
        form.append('categories', JSON.stringify(unique));
      }
    }
    if (note) {
      form.append('note', note);
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

  private reloadObject(): void {
    const objectId = this.#route.snapshot.paramMap.get('id');
    if (!objectId) return;

    this.#projectStore.loadObject(objectId).subscribe({
      next: (reloadedObject) => {
        if (reloadedObject) {
          // Create a new object reference to ensure change detection
          this.object.set({ ...reloadedObject });
        }
      },
      error: () => {
        this.#notificationService.showError(
          this.#translationService.instant('errors.loadObjectFailed'),
        );
      },
    });
  }

  async deleteObject(): Promise<void> {
    const objectId = this.object()?._id?.$oid;
    if (!objectId || this.deleting()) return;

    const message = this.#translationService.instant('objects.deleteObjectConfirm');
    const title = this.#translationService.instant('objects.deleteObject') || 'Delete Object';
    const confirmed = await this.#modalService.openConfirm({
      title,
      message,
      confirmText: 'common.delete',
      cancelText: 'common.cancel',
      confirmKind: 'danger',
    });
    if (!confirmed) return;

    this.deleting.set(true);
    this.#projectStore.deleteObject(objectId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.objectDeleted'),
        );
        this.deleting.set(false);
        this.#router.navigate(['/objects']);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('objects.deleteObjectFailed'),
        );
        this.deleting.set(false);
      },
    });
  }

  editObjectDetails(): void {
    const objectId = this.#route.snapshot.paramMap.get('id');
    if (!objectId) return;

    const currentObject = this.object();
    if (!currentObject) return;

    const { childRef } = this.#modalService.open({
      title: 'objects.editObject',
      component: EditObjectComponent,
      componentInputs: {
        objectData: currentObject,
      },
    });

    // Subscribe to the output event from the edit component
    if (childRef) {
      const editComponent = childRef.instance as EditObjectComponent;
      editComponent.objectUpdated.subscribe((updatedObject: Object) => {
        console.log('Object tab: Received objectUpdated event', updatedObject);
        // Immediately update the object signal with the new data
        this.object.set(updatedObject);
        // Also reload from server to ensure consistency
        this.reloadObject();
      });
    }
  }
}
