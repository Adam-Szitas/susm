import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import QRCode from 'qrcode';
import { ProjectStore } from '@store/project.store';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { FileService } from '@services/file.service';
import { NotificationService } from '@services/notification.service';
import {
  Object,
  FileGroup,
  DEFAULT_WORK_STATUS,
  fileGroupMatchesCategoryFilter,
  formatWorkStatus,
  formatObjectLabel,
  TodoItem,
  ObjectTodoEntry,
} from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';
import { FileListComponent } from '../../file-list/file-list.component';
import { HttpService } from '@services/http.service';
import { environment } from '../../../environment';
import { FileUploadModalComponent } from '../../file-upload-modal/file-upload-modal.component';
import { ModalService } from '@services/modal.service';
import { EditObjectComponent } from '../edit-object/object-edit.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../breadcrumb/breadcrumb.component';
import { ObjectTodosSectionComponent } from '../../todos/object-todos-section.component';
import { UserStore } from '@store/user.store';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { DetailFieldComponent } from '../../shared/detail-field.component';
import { StatusSelectComponent } from '../../shared/status-select.component';
import type { AppError } from '@services/error-handler.service';
import { isMissingResource404 } from '../../../utils/auth-http-error';
import { filter, map, switchMap, catchError } from 'rxjs';
import { EMPTY } from 'rxjs';

@Component({
  selector: 'app-object-tab',
  standalone: true,
  imports: [
    TranslateModule,
    FileListComponent,
    FileUploadModalComponent,
    BreadcrumbComponent,
    FormsModule,
    ObjectTodosSectionComponent,
    DetailFieldComponent,
    StatusSelectComponent,
    IconComponent,
  ],
  templateUrl: './object-tab.component.html',
  styleUrl: './object-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectTabComponent implements OnInit {
  protected readonly icons = icons;

  #projectStore = inject(ProjectStore);
  #route = inject(ActivatedRoute);
  #destroyRef = inject(DestroyRef);
  #router = inject(Router);
  #fileService = inject(FileService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #httpService = inject(HttpService);
  #modalService = inject(ModalService);
  #userStore = inject(UserStore);
  #platformId = inject(PLATFORM_ID);

  readonly isAdmin = this.#userStore.isAdmin;

  object = signal<Object | null>(null);
  /** Project context for breadcrumb when the store was cleared (e.g. page refresh). */
  objectProjectContext = signal<{ id: string; name: string } | null>(null);
  projectTodoItems = signal<TodoItem[]>([]);
  fileGroups = signal<FileGroup[]>([]);
  /** Category labels from `?categories=` (repeat or comma-separated); filters visible file groups. */
  urlFileGroupCategories = signal<string[]>([]);
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
  /** Collapsed by default — compact summary; expand for full object data. */
  objectDataExpanded = signal(false);
  readonly defaultStatus = DEFAULT_WORK_STATUS;
  readonly formatStatus = formatWorkStatus;

  readonly breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const obj = this.object();
    const storeProject = this.#projectStore.project();
    const context = this.objectProjectContext();
    const projectsLabel = this.#translationService.instant('navbar.projects');
    const objectsLabel = this.#translationService.instant('navbar.objects');
    const objectLabel = this.#objectDisplayName(obj);
    const projectId = storeProject?._id?.$oid ?? context?.id;
    const projectName = storeProject?.name ?? context?.name;

    if (!objectLabel) {
      if (projectId && projectName) {
        return [
          { label: projectsLabel, url: '/projects' },
          { label: projectName, url: `/projects/tab/${projectId}` },
          { label: '…' },
        ];
      }
      return [{ label: objectsLabel, url: '/objects' }, { label: '…' }];
    }

    if (projectId && projectName) {
      return [
        { label: projectsLabel, url: '/projects' },
        { label: projectName, url: `/projects/tab/${projectId}` },
        { label: objectLabel },
      ];
    }

    return [{ label: objectsLabel, url: '/objects' }, { label: objectLabel }];
  });

  readonly objectDisplayTitle = computed(() => this.#objectDisplayName(this.object()));

  readonly isPinnedOnPlan = computed(() => !!this.object()?.map_pin);

  readonly hasUrlFileGroupCategoryFilter = computed(() => this.urlFileGroupCategories().length > 0);

  readonly displayedFileGroups = computed(() => {
    const all = this.fileGroups().filter((g) => !g.deleted_at);
    const labels = this.urlFileGroupCategories();
    if (labels.length === 0) return all;
    return all.filter((g) => fileGroupMatchesCategoryFilter(g, labels));
  });

  constructor() {
    this.#route.queryParamMap
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((params) => {
        this.urlFileGroupCategories.set(parseCategoriesFromQueryParams(params));
      });
  }

  /** Short display name for the object (e.g. address parts or "Object"). */
  #objectDisplayName(obj: Object | null): string {
    if (!obj) return '';
    const label = formatObjectLabel(obj, {
      fallback: this.#translationService.instant('objects.title'),
    });
    return label || this.#translationService.instant('objects.title');
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.#platformId)) {
      return;
    }

    this.#route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => !!id),
        switchMap((objectId) => {
          this.objectProjectContext.set(null);
          this.loadProjectCategories(objectId);
          return this.#projectStore.loadObject(objectId).pipe(
            catchError((error: AppError) => {
              this.#notificationService.showError(
                error.message || this.#translationService.instant('errors.loadObjectFailed'),
              );
              if (isMissingResource404(error) && this.#router.url.startsWith('/objects/tab/')) {
                void this.#router.navigate(['/objects']);
              }
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((object) => {
        this.object.set(object);
        this.shareUrl.set(null);
        this.shareQrDataUrl.set(null);
        this.shareError.set(null);
        const projectItems = this.#projectStore.project()?.todo_items ?? [];
        if (projectItems.length) {
          this.projectTodoItems.set(projectItems);
        }
        const objectId = object._id?.$oid;
        if (objectId) {
          this.loadFiles(objectId);
        }
      });
  }

  private loadProjectCategories(objectId: string): void {
    this.#httpService
      .get<{
        project_id?: string;
        project_name?: string;
        categories?: string[];
        todo_items?: TodoItem[];
      }>(`object/${objectId}/project-categories`)
      .subscribe({
        next: (result) => {
          const projectId = result.project_id?.trim();
          const projectName = result.project_name?.trim();
          if (projectId && projectName) {
            this.objectProjectContext.set({ id: projectId, name: projectName });
          }
          this.projectCategories.set(result.categories || []);
          this.projectTodoItems.set(result.todo_items || []);
        },
        error: () => {
          this.objectProjectContext.set(null);
          this.projectCategories.set([]);
          this.projectTodoItems.set([]);
        },
      });
  }

  onTodoEntriesChanged(entries: ObjectTodoEntry[]): void {
    const current = this.object();
    if (!current) return;
    this.object.set({ ...current, todo_entries: entries.length ? entries : undefined });
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
            files: (fileGroup.files ?? []).map((file) => {
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

  clearUrlCategoryFilter(): void {
    const objectId = this.#route.snapshot.paramMap.get('id');
    if (!objectId) return;
    void this.#router.navigate(['/objects/tab', objectId], {
      queryParams: {},
      replaceUrl: true,
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

    this.#fileService
      .uploadFileForObject(form, objectId, {
        files,
        metadata: { description, note, categories },
      })
      .subscribe({
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

  toggleObjectData(): void {
    this.objectDataExpanded.update((v) => !v);
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

/** Reads `categories` from the URL (?categories=a&categories=b or comma-separated values). */
function parseCategoriesFromQueryParams(params: ParamMap): string[] {
  const raw = params.getAll('categories');
  const out: string[] = [];
  for (const entry of raw) {
    if (!entry?.trim()) continue;
    out.push(
      ...entry
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  return [...new Set(out)];
}
