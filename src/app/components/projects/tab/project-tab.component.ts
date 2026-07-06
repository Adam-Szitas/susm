import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';
import { ProjectStore } from '@store/project.store';
import { FilterComponent } from '../../filter/filter.component';
import {
  Filter,
  FilterResult,
  fileGroupCategoryLabels,
  fileGroupIsSoftDeleted,
  formatWorkStatus,
  Object,
  parseDateValue,
  ProtocolRecord,
  isUploadedProtocol,
  sortObjectsByStoredOrder,
  packFilteredFirstOrder,
  objectTodoCardClassNames,
} from '@models';
import { ModalService } from '@services/modal.service';
import { ObjectModalComponent } from '../../object/new-object/object-modal.component';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '@services/notification.service';
import { DateFormatService } from '@services/date-format.service';
import { TranslationService } from '@services/translation.service';
import { FileService } from '@services/file.service';
import { FileListComponent } from '../../file-list/file-list.component';
import { ProjectObjectOption } from '../../file-list/send-project-file-modal.component';
import { FileUploadModalComponent } from '../../file-upload-modal/file-upload-modal.component';
import { ProtocolService } from '@services/protocol.service';
import { ProtocolGenerateModalComponent } from '../../protocols/protocol-generate-modal.component';
import { CategoryManagementModalComponent } from '../category-management-modal.component';
import { ProjectTodoModalComponent } from '../../todos/project-todo-modal.component';
import { ProjectPlanModalComponent } from '../project-plan-modal/project-plan-modal.component';
import { UserStore } from '@store/user.store';
import { LocaleDatePipe } from '../../../pipes/locale-date.pipe';
import { EditProjectComponent } from '../edit-project/project-edit.component';
import { BreadcrumbComponent, BreadcrumbItem } from '../../breadcrumb/breadcrumb.component';
import {
  FilterPersistenceService,
  PersistedFilterState,
} from '@services/filter-persistence.service';
import { TrashIconComponent } from '../../shared/trash-icon.component';
import { TabGroupComponent, TabItem } from '../../shared/tab-group.component';
import { TabPanelComponent } from '../../shared/tab-panel.component';
import {
  VirtualScrollViewportComponent,
  VIRTUAL_SCROLL_DEFAULT_THRESHOLD,
} from '../../shared/virtual-scroll-viewport.component';
import { compactFormActions } from '../../shared/compact-form-actions';
import { reorderTargetIdFromTouch } from '../../../utils/touch-reorder';
import type { AppError } from '@services/error-handler.service';
import { isMissingResource404 } from '../../../utils/auth-http-error';

@Component({
  selector: 'app-project-tab',
  templateUrl: './project-tab.component.html',
  styleUrl: './project-tab.component.scss',
  standalone: true,
  host: {
    '[class.project-tab--details-expanded]': 'projectDataExpanded()',
  },
  imports: [
    CommonModule,
    FilterComponent,
    RouterLink,
    TranslateModule,
    FileListComponent,
    FileUploadModalComponent,
    LocaleDatePipe,
    BreadcrumbComponent,
    TrashIconComponent,
    TabGroupComponent,
    TabPanelComponent,
    VirtualScrollViewportComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTabComponent implements OnInit, OnDestroy {
  #route = inject(ActivatedRoute);
  #router = inject(Router);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #dateFormat = inject(DateFormatService);
  #fileService = inject(FileService);
  #protocolService = inject(ProtocolService);
  #filterPersistence = inject(FilterPersistenceService);
  #userStore = inject(UserStore);
  #platformId = inject(PLATFORM_ID);
  #destroyRef = inject(DestroyRef);
  #host = inject(ElementRef<HTMLElement>);
  #routeSubscription?: Subscription;
  #mobilePanelHeightMq?: MediaQueryList;

  readonly projectTabChrome = viewChild<ElementRef<HTMLElement>>('projectTabChrome');

  readonly isAdmin = this.#userStore.isAdmin;

  project = this.#projectStore.project;
  objects = this.#projectStore.objects;
  files = this.#projectStore.files;
  uploading = signal(false);
  uploadModalOpen = signal(false);
  selectedFiles = signal<globalThis.File[]>([]);
  updatingCategory = signal(false);
  downloadingProtocol = signal<string | null>(null);
  loadingTemplates = signal(false);
  uploadingProtocolPdf = signal(false);
  filteredObjects = signal<Object[]>([]);
  #currentFilter = signal<FilterResult>({});
  #filtersVisible = false;
  filtersVisible = signal(false);
  readonly projectFilter = viewChild(FilterComponent);
  /** Icon-only toolbar buttons on viewports ≤768px. */
  readonly toolbarIconOnly = compactFormActions();
  readonly virtualScrollThreshold = VIRTUAL_SCROLL_DEFAULT_THRESHOLD;
  /** Virtual scroll only on desktop columns — mobile tab panel scrolls the full list. */
  readonly objectVirtualScrollThreshold = computed(() =>
    this.toolbarIconOnly() ? Number.MAX_SAFE_INTEGER : VIRTUAL_SCROLL_DEFAULT_THRESHOLD,
  );
  #projectFilterKey = '';
  restoredFilterState = signal<PersistedFilterState | null>(null);
  /** Collapsed by default — compact summary; expand for full project data + category. */
  projectDataExpanded = signal(false);
  objectReorderMode = signal(false);
  objectReorderSaving = signal(false);
  draggedObjectId = signal<string | null>(null);
  dragOverObjectId = signal<string | null>(null);
  #touchObjectReorderActive = false;
  /** Working order while reorder mode is active (all project objects). */
  objectOrderIds = signal<string[]>([]);
  public readonly formatStatus = formatWorkStatus;

  objectCardHeadline(object: Object): string {
    const addr = object.address;
    if (!addr) return '';
    const parts = [
      addr.house_number?.trim(),
      addr.level?.trim(),
      addr.door_number?.trim(),
    ].filter((part): part is string => !!part);
    return parts.join(', ');
  }

  /** Compact mobile card label — house number only. */
  objectCardMobileLabel(object: Object): string {
    return object.address?.house_number?.trim() ?? '';
  }

  /** Non-empty label for object card headings (accessibility + file pickers). */
  objectCardDisplayLabel(object: Object, compact = false): string {
    const addressLabel = compact
      ? this.objectCardMobileLabel(object) || this.objectCardHeadline(object)
      : this.objectCardHeadline(object) || this.objectCardMobileLabel(object);
    return (
      addressLabel ||
      object._id?.$oid ||
      this.#translationService.instant('objects.newObject')
    );
  }

  readonly projectDisplayName = computed(() => {
    const name = this.project()?.name?.trim();
    return name || '…';
  });

  readonly sortedObjects = computed(() => sortObjectsByStoredOrder(this.objects()));

  readonly projectObjectOptions = computed<ProjectObjectOption[]>(() =>
    this.sortedObjects()
      .map((object) => {
        const objectId = object._id?.$oid;
        if (!objectId) return null;
        return {
          objectId,
          label: this.objectCardDisplayLabel(object),
        };
      })
      .filter((row): row is ProjectObjectOption => row !== null),
  );

  /** Precomputed per-object todo card classes — avoids O(n) work each change detection pass. */
  readonly objectCardClassMap = computed(() => {
    const todoItems = this.project()?.todo_items;
    const map = new Map<string, string[]>();
    for (const object of this.filteredObjects()) {
      const id = object._id?.$oid;
      if (!id) continue;
      map.set(id, objectTodoCardClassNames(object.todo_entries, todoItems));
    }
    for (const object of this.objectsInReorderMode()) {
      const id = object._id?.$oid;
      if (!id || map.has(id)) continue;
      map.set(id, objectTodoCardClassNames(object.todo_entries, todoItems));
    }
    return map;
  });

  /** Fixed virtual row height (px), including inter-card gap. */
  readonly objectCardItemSize = computed(() => (this.toolbarIconOnly() ? 60 : 96));

  readonly objectListMaxHeight = computed(() => 'min(65dvh, 720px)');
  readonly objectListFillHeight = computed(() => false);

  readonly objectsInReorderMode = computed(() => {
    const byId = new Map(
      this.sortedObjects()
        .map((o) => [o._id?.$oid, o] as const)
        .filter((entry): entry is [string, Object] => !!entry[0]),
    );
    return this.objectOrderIds()
      .map((id) => byId.get(id))
      .filter((o): o is Object => !!o);
  });

  /** Active mobile content tab (objects | protocols | files). */
  activeContentTab = signal('objects');

  readonly contentTabs = computed<TabItem[]>(() => {
    const objectCount = this.objectReorderMode()
      ? this.objectsInReorderMode().length
      : this.filteredObjects().length;

    return [
      {
        id: 'objects',
        label: this.#translationService.instant('navbar.objects'),
        badge: objectCount > 0 ? objectCount : null,
      },
      {
        id: 'protocols',
        label: this.#translationService.instant('protocols.title'),
        badge: this.projectProtocols().length || null,
      },
      {
        id: 'files',
        label: this.#translationService.instant('files.title'),
        badge: this.files()?.length ? this.files()!.length : null,
      },
    ];
  });

  readonly contentTabsAriaLabel = computed(() =>
    this.#translationService.instant('projects.contentSections'),
  );

  readonly projectAddressLine = computed(() => {
    const addr = this.project()?.address;
    if (!addr) return '';
    return [addr.street, addr.postal_code].filter((p) => !!p?.trim()).join(', ');
  });
  readonly projectProtocols = computed(() => {
    const protocols = this.project()?.protocols ?? [];
    return [...protocols].sort((a, b) => {
      const aUploaded = !!a.uploaded_pdf_path;
      const bUploaded = !!b.uploaded_pdf_path;
      if (aUploaded !== bUploaded) {
        return aUploaded ? -1 : 1;
      }
      const aTime = a.generated_at ? new Date(a.generated_at).getTime() : 0;
      const bTime = b.generated_at ? new Date(b.generated_at).getTime() : 0;
      return bTime - aTime;
    });
  });

  readonly breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const p = this.project();
    const projectsLabel = this.#translationService.instant('navbar.projects');
    if (!p?.name) {
      return [{ label: projectsLabel, url: '/projects' }, { label: '…' }];
    }
    return [{ label: projectsLabel, url: '/projects' }, { label: p.name }];
  });

  /** Query params forwarded when opening an object from this view (multi-selected file-group categories). */
  readonly objectTabLinkQueryParams = computed(() => {
    const cats = this.#currentFilter().selectedCategories?.filter((c) => !!c?.trim()) ?? [];
    return cats.length ? { categories: cats } : {};
  });

  constructor() {
    effect(() => {
      const objects = this.objects() || [];
      const appliedFilter = this.#currentFilter();
      this.filteredObjects.set(this.#applyFilters(objects, appliedFilter));
    });

    afterNextRender(() => {
      if (!isPlatformBrowser(this.#platformId)) return;
      this.#setupMobileTabPanelHeight();
    });

    effect(() => {
      this.projectDataExpanded();
      this.filtersVisible();
      queueMicrotask(() => this.#syncMobileTabPanelHeight());
    });
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.#platformId)) {
      return;
    }

    this.#routeSubscription = this.#route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => id !== null),
        distinctUntilChanged(),
      )
      .subscribe((projectId) => {
        this.#projectStore.loadProject(projectId).subscribe({
          error: (error: AppError) => {
            if (isMissingResource404(error)) {
              void this.#router.navigate(['/projects']);
            }
          },
        });

        this.#projectFilterKey = `project_${projectId}`;
        const restored = this.#filterPersistence.restore(this.#projectFilterKey);
        if (restored) {
          this.restoredFilterState.set(restored);
          this.#currentFilter.set(restored.filter);
          this.#filtersVisible = restored.filtersVisible;
          this.filtersVisible.set(restored.filtersVisible);
        } else {
          this.restoredFilterState.set(null);
          this.#currentFilter.set({});
        }
      });
  }

  ngOnDestroy(): void {
    this.#routeSubscription?.unsubscribe();
    this.#touchObjectReorderActive = false;
  }

  filterData(): Filter {
    const project = this.project();
    return {
      placeholder: 'common.search',
      value: '',
      label: 'common.search',
      showDateRange: true,
      showCategory: true,
      multiSelectCategories: true,
      categories: project?.categories || [],
      showSort: true,
    };
  }

  filterChanged(result: FilterResult) {
    this.#currentFilter.set(result);
    if (this.#projectFilterKey) {
      this.#filterPersistence.save(this.#projectFilterKey, {
        filter: result,
        filtersVisible: this.#filtersVisible,
      });
    }
  }

  toggleFiltersFromToolbar(): void {
    this.projectFilter()?.toggleFilters();
  }

  onFiltersVisibleChange(visible: boolean): void {
    this.#filtersVisible = visible;
    this.filtersVisible.set(visible);
    if (this.#projectFilterKey) {
      this.#filterPersistence.save(this.#projectFilterKey, {
        filter: this.#currentFilter(),
        filtersVisible: visible,
      });
    }
  }

  addObject(): void {
    this.#modalService.open({
      title: 'objects.newObjects',
      component: ObjectModalComponent,
      wide: true,
    });
  }

  manageCategories(): void {
    const project = this.project();
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!project || !projectId) return;

    this.#modalService.open({
      title: 'projects.manageCategories',
      component: CategoryManagementModalComponent,
      componentInputs: {
        projectId,
        categories: project.categories || [],
      },
    });
  }

  openProjectChecklist(): void {
    const project = this.project();
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!project || !projectId) return;

    this.#modalService.open({
      title: 'todos.projectChecklist',
      component: ProjectTodoModalComponent,
      componentInputs: {
        projectId,
        todoItems: project.todo_items || [],
        objects: this.sortedObjects(),
      },
      wide: true,
    });
  }

  openStreetPlan(): void {
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId) return;

    this.#modalService.open({
      title: 'projectPlan.title',
      component: ProjectPlanModalComponent,
      componentInputs: { projectId },
      wide: true,
    });
  }

  objectTodoCardClasses(object: Object): string[] {
    const id = object._id?.$oid;
    if (!id) return [];
    return this.objectCardClassMap().get(id) ?? [];
  }

  trackObjectById(_index: number, object: Object): string {
    return object._id?.$oid ?? String(_index);
  }

  generateProtocol(): void {
    const availableObjects = sortObjectsByStoredOrder(this.filteredObjects());
    if (!availableObjects.length) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.noObjectsAvailable'),
      );
      return;
    }

    this.loadingTemplates.set(true);
    this.#protocolService.getTemplates().subscribe({
      next: (templates) => {
        this.loadingTemplates.set(false);
        if (templates.length === 0) {
          this.#notificationService.showError(
            this.#translationService.instant('protocols.noTemplates'),
          );
          return;
        }
        const projectId = this.#route.snapshot.paramMap.get('id');
        if (!projectId) {
          this.#notificationService.showError(
            this.#translationService.instant('protocols.generateMissingData'),
          );
          return;
        }
        this.#modalService.open({
          title: 'protocols.generateProtocol',
          component: ProtocolGenerateModalComponent,
          componentInputs: {
            projectId,
            objects: availableObjects,
            templates,
            existingProtocols: this.projectProtocols(),
            projectCategories: this.project()?.categories ?? [],
            todoItems: this.project()?.todo_items ?? [],
          },
        });
      },
      error: (error) => {
        this.loadingTemplates.set(false);
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.loadTemplatesFailed'),
        );
      },
    });
  }

  downloadProtocol(protocol: ProtocolRecord): void {
    const projectId = protocol.project_id?.$oid;
    const protocolId = protocol._id?.$oid;

    if (!projectId || !protocolId) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.downloadFailed'),
      );
      return;
    }

    // Prevent multiple simultaneous downloads
    if (this.downloadingProtocol() === protocolId) {
      return;
    }

    this.downloadingProtocol.set(protocolId);
    this.#protocolService.downloadExistingProtocol(projectId, protocolId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('protocols.generated'),
        );
        this.downloadingProtocol.set(null);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.downloadFailed'),
        );
        this.downloadingProtocol.set(null);
      },
    });
  }

  deleteProtocol(protocol: ProtocolRecord): void {
    const projectId = protocol.project_id?.$oid;
    const protocolId = protocol._id?.$oid;

    if (!projectId || !protocolId) {
      this.#notificationService.showError(
        this.#translationService.instant('protocol.deleteFailed'),
      );
      return;
    }

    this.#protocolService.deleteProtocol(projectId, protocolId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(this.#translationService.instant('protocol.deleted'));
        this.#projectStore.removeProtocolInstance(protocolId);
        this.#projectStore.loadProject(projectId).subscribe();
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocol.deleteFailed'),
        );
      },
    });
  }

  readonly isUploadedProtocol = isUploadedProtocol;

  protocolDateLabel(protocol: ProtocolRecord): string {
    if (!protocol.generated_at) {
      return '';
    }
    const date = this.#dateFormat.formatDateTime(protocol.generated_at);
    const key = isUploadedProtocol(protocol) ? 'protocols.uploadedAt' : 'protocols.generatedAt';
    const prefix = this.#translationService.instant(key);
    return prefix && prefix !== key ? `${prefix}: ${date}` : date;
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
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.objectIdNotFound'),
      );
      this.uploadModalOpen.set(false);
      return;
    }

    this.uploadFiles(data.files, data.description, projectId, data.note);
  }

  onCancelUpload(): void {
    this.uploadModalOpen.set(false);
    this.selectedFiles.set([]);
  }

  private uploadFiles(
    files: globalThis.File[],
    description: string,
    projectId: string,
    note?: string,
  ): void {
    if (!files.length || this.uploading()) {
      return;
    }

    this.uploading.set(true);

    const form = new FormData();
    files.forEach((file) => {
      form.append('avatar', file, file.name);
    });

    if (description) {
      form.append('description', description);
    }
    if (note) {
      form.append('note', note);
    }

    this.#fileService
      .uploadFileForProject(form, projectId, files, { description, note })
      .subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.uploadSuccess'),
        );
        this.#projectStore.loadProject(projectId).subscribe();
        this.uploading.set(false);
        this.uploadModalOpen.set(false);
        this.selectedFiles.set([]);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('errors.uploadFailed'),
        );
        this.uploading.set(false);
      },
    });
  }

  toggleObjectReorderMode(): void {
    const turningOn = !this.objectReorderMode();
    this.objectReorderMode.update((v) => !v);
    if (turningOn) {
      const ids = this.sortedObjects()
        .map((o) => o._id?.$oid)
        .filter((id): id is string => !!id);
      this.objectOrderIds.set(ids);
      if (this.toolbarIconOnly()) {
        this.activeContentTab.set('objects');
      }
    } else {
      this.#touchObjectReorderActive = false;
      this.draggedObjectId.set(null);
      this.dragOverObjectId.set(null);
    }
  }

  hasSortDirection(): boolean {
    const dir = this.#currentFilter().sortDirection;
    return dir === 'asc' || dir === 'desc';
  }

  applySortOrder(): void {
    if (!this.hasSortDirection() || this.objectReorderMode() || this.objectReorderSaving()) {
      return;
    }

    const fullOrder = this.sortedObjects()
      .map((o) => o._id?.$oid)
      .filter((id): id is string => !!id);
    const visibleOrder = this.filteredObjects()
      .map((o) => o._id?.$oid)
      .filter((id): id is string => !!id);
    if (!visibleOrder.length) {
      return;
    }

    const newOrder = packFilteredFirstOrder(fullOrder, visibleOrder);
    this.#saveObjectOrder(newOrder, { clearSortAfter: true });
  }

  #saveObjectOrder(
    objectIds: string[],
    options?: { clearSortAfter?: boolean },
  ): void {
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId || this.objectReorderSaving()) return;

    this.objectReorderSaving.set(true);
    this.#projectStore
      .reorderObjects(projectId, objectIds)
      .pipe(finalize(() => this.objectReorderSaving.set(false)))
      .subscribe({
        next: () => {
          this.objectOrderIds.set(objectIds);
          if (options?.clearSortAfter) {
            this.projectFilter()?.clearSortDirection();
          }
          this.#notificationService.showSuccess(
            this.#translationService.instant(
              options?.clearSortAfter
                ? 'projects.applySortOrderSuccess'
                : 'projects.objectOrderSaved',
            ),
          );
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('projects.objectOrderSaveFailed'),
          );
        },
      });
  }

  moveObjectUp(object: Object): void {
    const id = object._id?.$oid;
    if (!id) return;
    const order = [...this.objectOrderIds()];
    const index = order.indexOf(id);
    if (index <= 0) return;
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    this.objectOrderIds.set(order);
    this.#saveObjectOrder(order);
  }

  moveObjectDown(object: Object): void {
    const id = object._id?.$oid;
    if (!id) return;
    const order = [...this.objectOrderIds()];
    const index = order.indexOf(id);
    if (index === -1 || index >= order.length - 1) return;
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    this.objectOrderIds.set(order);
    this.#saveObjectOrder(order);
  }

  #applyObjectReorder(draggedId: string, targetId: string): void {
    if (draggedId === targetId) return;

    const order = [...this.objectOrderIds()];
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetId);
    if (from === -1 || to === -1) return;

    order.splice(from, 1);
    order.splice(to, 0, draggedId);
    this.objectOrderIds.set(order);
    this.#saveObjectOrder(order);
  }

  onObjectDragStart(event: DragEvent, object: Object): void {
    const id = object._id?.$oid;
    if (!id) return;
    event.stopPropagation();
    this.draggedObjectId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  onObjectDragOver(event: DragEvent, object: Object): void {
    event.preventDefault();
    const id = object._id?.$oid;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (id && id !== this.draggedObjectId()) {
      this.dragOverObjectId.set(id);
    }
  }

  onObjectDragLeave(object: Object): void {
    const id = object._id?.$oid;
    if (id && this.dragOverObjectId() === id) {
      this.dragOverObjectId.set(null);
    }
  }

  onObjectDrop(event: DragEvent, target: Object): void {
    event.preventDefault();
    const draggedId = this.draggedObjectId();
    const targetId = target._id?.$oid;
    if (!draggedId || !targetId) {
      this.onObjectDragEnd();
      return;
    }
    this.#applyObjectReorder(draggedId, targetId);
    this.onObjectDragEnd();
  }

  onObjectDragEnd(): void {
    this.#touchObjectReorderActive = false;
    this.draggedObjectId.set(null);
    this.dragOverObjectId.set(null);
  }

  onObjectTouchStart(event: TouchEvent, object: Object): void {
    if (!isPlatformBrowser(this.#platformId)) return;
    const id = object._id?.$oid;
    if (!id || this.objectReorderSaving()) return;
    event.preventDefault();
    event.stopPropagation();
    this.#touchObjectReorderActive = true;
    this.draggedObjectId.set(id);
  }

  onObjectTouchMove(event: TouchEvent): void {
    if (!this.#touchObjectReorderActive) return;
    event.preventDefault();
    const overId = reorderTargetIdFromTouch(event);
    const draggedId = this.draggedObjectId();
    if (overId && overId !== draggedId) {
      this.dragOverObjectId.set(overId);
    }
  }

  onObjectTouchEnd(event: TouchEvent): void {
    if (!this.#touchObjectReorderActive) return;
    event.preventDefault();
    const draggedId = this.draggedObjectId();
    const targetId = reorderTargetIdFromTouch(event) ?? this.dragOverObjectId();
    if (draggedId && targetId) {
      this.#applyObjectReorder(draggedId, targetId);
    }
    this.onObjectDragEnd();
  }

  onObjectTouchCancel(): void {
    if (!this.#touchObjectReorderActive) return;
    this.onObjectDragEnd();
  }

  #applyFilters(objects: Object[], filter: FilterResult): Object[] {
    let filtered = sortObjectsByStoredOrder([...objects]);

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filtered = filtered.filter((obj) => {
        const addr = obj.address;
        // ObjectAddress only has level, door_number, and postal_code
        const addressText = [addr?.level, addr?.door_number, addr?.postal_code]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const noteText = obj.note?.toLowerCase() ?? '';

        return addressText.includes(searchLower) || noteText.includes(searchLower);
      });
    }

    const selectedGroupCategories = filter.selectedCategories?.filter((c) => c?.trim()) ?? [];
    if (selectedGroupCategories.length > 0) {
      const selectedSet = new Set(selectedGroupCategories);
      filtered = filtered.filter((obj) => {
        const groups = obj.file_groups ?? [];
        return groups.some(
          (g) =>
            !fileGroupIsSoftDeleted(g) &&
            fileGroupCategoryLabels(g).some((label) => selectedSet.has(label)),
        );
      });
    }

    if (filter.dateFrom || filter.dateTo) {
      filtered = filtered.filter((obj) => {
        const objDate = parseDateValue(obj.createdAt ?? obj.created_at);
        if (!objDate) return false;

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

    // Apply sorting if sort direction is specified
    if (filter.sortDirection) {
      filtered = this.#applySort(filtered, filter.sortDirection);
    }

    return filtered;
  }

  #applySort(objects: Object[], sortDirection: string): Object[] {
    const sorted = [...objects];

    sorted.sort((a, b) => {
      // Sort by house_number first, then door_number (ignoring level)
      const aHouseNumber = a.address?.house_number ?? '';
      const bHouseNumber = b.address?.house_number ?? '';
      const aDoorNumber = a.address?.door_number ?? '';
      const bDoorNumber = b.address?.door_number ?? '';

      // Extract numeric values for comparison
      const aHouseNum = this.#extractNumber(aHouseNumber);
      const bHouseNum = this.#extractNumber(bHouseNumber);
      const aDoorNum = this.#extractNumber(aDoorNumber);
      const bDoorNum = this.#extractNumber(bDoorNumber);

      // Compare house_number first
      let houseComparison = 0;

      if (aHouseNum !== null && bHouseNum !== null) {
        // Both are numeric - compare numerically
        houseComparison = aHouseNum - bHouseNum;
      } else if (aHouseNum !== null) {
        // a is numeric, b is not - numeric comes first
        houseComparison = -1;
      } else if (bHouseNum !== null) {
        // b is numeric, a is not - numeric comes first
        houseComparison = 1;
      } else {
        // Both are non-numeric - compare alphabetically
        houseComparison = aHouseNumber.localeCompare(bHouseNumber);
      }

      // If house numbers are equal, compare door numbers
      if (houseComparison === 0) {
        if (aDoorNum !== null && bDoorNum !== null) {
          // Both are numeric - compare numerically
          houseComparison = aDoorNum - bDoorNum;
        } else if (aDoorNum !== null) {
          // a is numeric, b is not - numeric comes first
          houseComparison = -1;
        } else if (bDoorNum !== null) {
          // b is numeric, a is not - numeric comes first
          houseComparison = 1;
        } else {
          // Both are non-numeric or empty - compare alphabetically
          const aDoor = aDoorNumber || '';
          const bDoor = bDoorNumber || '';
          houseComparison = aDoor.localeCompare(bDoor);
        }
      }

      // Apply sort direction
      return sortDirection === 'asc' ? houseComparison : -houseComparison;
    });

    return sorted;
  }

  #extractNumber(value: string): number | null {
    // Extract the first number from a string (e.g., "3" from "3", "3rd" from "3rd", "12" from "12A")
    const match = value.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  onFileDeleted(): void {
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (projectId) {
      this.#projectStore.loadProject(projectId).subscribe();
    }
  }

  onProtocolPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    const lower = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
    if (!isPdf) {
      this.#notificationService.showError(this.#translationService.instant('protocols.pdfOnly'));
      return;
    }

    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId || this.uploadingProtocolPdf()) return;

    this.uploadingProtocolPdf.set(true);
    this.#protocolService.uploadProtocolPdf(projectId, file).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('protocols.uploadPdfSuccess'),
        );
        this.#projectStore.loadProject(projectId).subscribe();
        this.uploadingProtocolPdf.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.uploadPdfFailed'),
        );
        this.uploadingProtocolPdf.set(false);
      },
    });
  }

  toggleProjectData(): void {
    this.projectDataExpanded.update((v) => !v);
  }

  startEditingProject(): void {
    this.#modalService.open({
      title: 'projects.editProject',
      component: EditProjectComponent,
      componentInputs: {
        projectData: this.project(),
      },
    });
  }

  updateCategory(category: string | null): void {
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId) return;

    // Handle empty string as null
    const categoryValue = category === '' ? null : category;

    this.updatingCategory.set(true);
    this.#projectStore.updateProjectCategory(projectId, categoryValue).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('projects.categoryUpdated'),
        );
        this.updatingCategory.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('projects.updateCategoryFailed'),
        );
        this.updatingCategory.set(false);
      },
    });
  }

  #setupMobileTabPanelHeight(): void {
    this.#mobilePanelHeightMq = window.matchMedia('(max-width: 768px)');
    const chrome = this.projectTabChrome()?.nativeElement;
    if (!chrome) return;

    const sync = () => this.#syncMobileTabPanelHeight();
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(chrome);

    this.#mobilePanelHeightMq.addEventListener('change', sync);
    window.addEventListener('resize', sync, { passive: true });
    window.visualViewport?.addEventListener('resize', sync);

    this.#destroyRef.onDestroy(() => {
      ro.disconnect();
      this.#mobilePanelHeightMq?.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    });
  }

  #syncMobileTabPanelHeight(): void {
    if (!isPlatformBrowser(this.#platformId)) return;

    const mq = this.#mobilePanelHeightMq ?? window.matchMedia('(max-width: 768px)');
    const host = this.#host.nativeElement;

    if (!mq.matches) {
      host.style.removeProperty('--project-tab-panel-height');
      return;
    }

    const chrome = this.projectTabChrome()?.nativeElement;
    if (!chrome) return;

    const tabBarHeight = 48;
    const layoutGap = 12;
    const navbarHeight = this.#readNavbarHeightPx();
    const fabClearance = this.#readFloatingActionClearancePx();
    const chromeHeight = chrome.getBoundingClientRect().height;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const panelHeight = Math.round(
      viewportHeight - navbarHeight - chromeHeight - tabBarHeight - layoutGap - fabClearance,
    );

    host.style.setProperty('--project-tab-panel-height', `${Math.max(panelHeight, 120)}px`);
  }

  #readNavbarHeightPx(): number {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-navbar-block')
      .trim();
    if (!raw) return 56;
    if (raw.endsWith('rem')) return parseFloat(raw) * 16;
    if (raw.endsWith('px')) return parseFloat(raw);
    return 56;
  }

  #readFloatingActionClearancePx(): number {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--app-floating-action-clearance')
      .trim();
    if (!raw) return 80;
    if (raw.endsWith('rem')) return parseFloat(raw) * 16;
    if (raw.endsWith('px')) return parseFloat(raw);
    return 80;
  }
}
