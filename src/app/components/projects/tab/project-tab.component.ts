import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ProjectStore } from '@store/project.store';
import { FilterComponent } from '../../filter/filter.component';
import { Filter, FilterResult, formatWorkStatus, Object, ProtocolRecord } from '@models';
import { ModalService } from '@services/modal.service';
import { ObjectModalComponent } from '../../object/new-object/object-modal.component';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { FileService } from '@services/file.service';
import { FileListComponent } from '../../file-list/file-list.component';
import { ProtocolService } from '@services/protocol.service';
import { ProtocolGenerateModalComponent } from '../../protocols/protocol-generate-modal.component';
import { CategoryManagementModalComponent } from '../category-management-modal.component';
import { StatusPillComponent } from '../../status-pill/app-status-pill.component';
import { DatePipe } from '@angular/common';
import { EditProjectComponent } from '../edit-project/project-edit.component';

@Component({
  selector: 'app-project-tab',
  templateUrl: './project-tab.component.html',
  styleUrl: './project-tab.component.scss',
  standalone: true,
  imports: [
    FilterComponent,
    RouterLink,
    TranslateModule,
    FileListComponent,
    StatusPillComponent,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTabComponent implements OnInit, OnDestroy {
  #route = inject(ActivatedRoute);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #fileService = inject(FileService);
  #protocolService = inject(ProtocolService);
  #routeSubscription?: Subscription;

  project = this.#projectStore.project;
  objects = this.#projectStore.objects;
  files = this.#projectStore.files;
  imagePreviewUrl = signal<string | null>(null);
  uploading = signal(false);
  updatingCategory = signal(false);
  filteredObjects = signal<Object[]>([]);
  #currentFilter = signal<FilterResult>({});
  public readonly formatStatus = formatWorkStatus;
  readonly projectProtocols = computed(() => {
    const protocols = this.project()?.protocols ?? [];
    return [...protocols].sort((a, b) => {
      const aTime = a.generated_at ? new Date(a.generated_at).getTime() : 0;
      const bTime = b.generated_at ? new Date(b.generated_at).getTime() : 0;
      return bTime - aTime;
    });
  });

  constructor() {
    effect(() => {
      const objects = this.objects() || [];
      const appliedFilter = this.#currentFilter();
      this.filteredObjects.set(this.#applyFilters(objects, appliedFilter));
    });
  }

  ngOnInit(): void {
    // Subscribe to route parameter changes to reload project when route changes
    this.#routeSubscription = this.#route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => id !== null),
      )
      .subscribe((projectId) => {
        this.#projectStore.loadProject(projectId);
      });

    this.#currentFilter.set({});
  }

  ngOnDestroy(): void {
    this.#routeSubscription?.unsubscribe();
  }

  filterData(): Filter {
    const project = this.project();
    return {
      placeholder: 'common.search',
      value: '',
      label: 'common.search',
      showDateRange: true,
      showCategory: true,
      categories: project?.categories || [],
    };
  }

  filterChanged(result: FilterResult) {
    this.#currentFilter.set(result);
  }

  addObject(): void {
    this.#modalService.open({
      title: 'objects.newObject',
      component: ObjectModalComponent,
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

  generateProtocol(): void {
    const availableObjects = this.filteredObjects();
    if (!availableObjects.length) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.noObjectsAvailable'),
      );
      return;
    }

    this.#protocolService.getTemplates().subscribe({
      next: (templates) => {
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
          },
        });
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.loadTemplatesFailed'),
        );
      },
    });
  }

  downloadProtocol(protocol: ProtocolRecord): void {
    const projectId = this.#route.snapshot.paramMap.get('id');
    const protocolId = protocol._id?.$oid;

    if (!projectId || !protocolId) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.downloadFailed'),
      );
      return;
    }

    this.#protocolService
      .downloadExistingProtocol(projectId, protocolId)
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('protocols.generated'),
          );
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('protocols.downloadFailed'),
          );
        },
      });
  }

  protocolDescription(protocol: ProtocolRecord): string {
    if (protocol.object_names?.length) {
      return protocol.object_names.join(', ');
    }
    return this.#translationService.instant('protocols.noObjectsAvailable');
  }

  protocolGeneratedAt(protocol: ProtocolRecord): string {
    if (!protocol.generated_at) {
      return '';
    }
    const date = new Date(protocol.generated_at);
    return date.toLocaleString();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.imageFileRequired'),
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
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.objectIdNotFound'),
      );
      return;
    }

    this.uploadFile(file, projectId);
  }

  private uploadFile(file: File, projectId: string): void {
    this.uploading.set(true);

    const form = new FormData();
    form.append('avatar', file, file.name);

    this.#fileService.uploadFileForProject(form, projectId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.uploadSuccess'),
        );
        this.#projectStore.loadProject(projectId);
        this.uploading.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('errors.uploadFailed'),
        );
        this.uploading.set(false);
        this.imagePreviewUrl.set(null);
      },
    });
  }

  #applyFilters(objects: Object[], filter: FilterResult): Object[] {
    let filtered = [...objects];

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      filtered = filtered.filter((obj) => {
        const addr = obj.address;
        const addressText = [addr?.street, addr?.house_number, addr?.level, addr?.door_number]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const noteText = obj.note?.toLowerCase() ?? '';

        return addressText.includes(searchLower) || noteText.includes(searchLower);
      });
    }

    if (filter.category) {
      filtered = filtered.filter((obj) => obj.category === filter.category);
    }

    if (filter.dateFrom || filter.dateTo) {
      filtered = filtered.filter((obj) => {
        // Support both createdAt (frontend model) and created_at (backend Mongo field)
        const createdRaw = obj.createdAt ?? obj.created_at;
        if (!createdRaw) return false;

        const objDate = new Date(createdRaw);
        if (Number.isNaN(objDate.getTime())) return false;

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

    return filtered;
  }

  onFileDeleted(): void {
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (projectId) {
      this.#projectStore.loadProject(projectId);
    }
  }

  toggleArchiveProject(archive: boolean): void {
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId) return;

    if (archive) {
      // Prompt for archive comment
      const comment = prompt(
        this.#translationService.instant('projects.archiveCommentPrompt')
      );
      // Allow null/empty comment
      this.#projectStore.toggleArchiveProject(projectId, archive, comment || undefined);
    } else {
      // Unarchiving doesn't need a comment
      this.#projectStore.toggleArchiveProject(projectId, archive);
    }
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
}
