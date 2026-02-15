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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
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
import { ImageCompressionService } from '@services/image-compression.service';
import { BreadcrumbComponent, BreadcrumbItem } from '../../breadcrumb/breadcrumb.component';

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
    BreadcrumbComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTabComponent implements OnInit, OnDestroy {
  #route = inject(ActivatedRoute);
  #router = inject(Router);
  #projectStore = inject(ProjectStore);
  #userStore = inject(UserStore);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #fileService = inject(FileService);
  #protocolService = inject(ProtocolService);
  #imageCompressionService = inject(ImageCompressionService);
  #routeSubscription?: Subscription;

  project = this.#projectStore.project;
  objects = this.#projectStore.objects;
  isAdmin = this.#userStore.isAdmin;
  files = this.#projectStore.files;
  imagePreviewUrl = signal<string | null>(null);
  uploading = signal(false);
  updatingCategory = signal(false);
  downloadingProtocol = signal<string | null>(null); // Track which protocol is being downloaded
  loadingTemplates = signal(false);
  archivingProject = signal(false);
  deletingProject = signal(false);
  protocolsSectionOpen = signal(false);
  fileListSectionOpen = signal(false);
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

  readonly breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const p = this.project();
    const projectsLabel = this.#translationService.instant('navbar.projects');
    if (!p?.name) {
      return [{ label: projectsLabel, url: '/projects' }, { label: '…' }];
    }
    return [
      { label: projectsLabel, url: '/projects' },
      { label: p.name },
    ];
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
      showSort: true,
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
      next: (message) => {
        this.#notificationService.showSuccess(this.#translationService.instant(message));
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocol.deleteFailed'),
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

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      input.value = '';
      return;
    }

    const file = input.files[0];

    // Validate file type (images only)
    if (!this.#imageCompressionService.isImageFile(file)) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.imageFileRequired'),
      );
      this.imagePreviewUrl.set(null);
      input.value = '';
      return;
    }

    // Upload file
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.objectIdNotFound'),
      );
      input.value = '';
      return;
    }

    try {
      // Compress image before upload
      const compressedFile = await this.#imageCompressionService.compressImage(file);

      // Show preview
      const reader = new FileReader();
      reader.onerror = () => {
        this.#notificationService.showError(
          this.#translationService.instant('errors.fileReadFailed'),
        );
        input.value = '';
      };
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imagePreviewUrl.set(e.target?.result as string);
      };
      reader.readAsDataURL(compressedFile);

      // Upload compressed file
      this.uploadFile(compressedFile, projectId);
    } catch (error) {
      this.#notificationService.showError(
        error instanceof Error
          ? error.message
          : this.#translationService.instant('errors.imageCompressionFailed'),
      );
      input.value = '';
    }
  }

  private uploadFile(file: File, projectId: string): void {
    // Prevent multiple simultaneous uploads
    if (this.uploading()) {
      return;
    }

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
        this.imagePreviewUrl.set(null);
        // Reset file input
        const fileInput = document.getElementById('file') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('errors.uploadFailed'),
        );
        this.uploading.set(false);
        this.imagePreviewUrl.set(null);
        // Reset file input on error
        const fileInput = document.getElementById('file') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      },
    });
  }

  #applyFilters(objects: Object[], filter: FilterResult): Object[] {
    let filtered = [...objects];

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
      this.#projectStore.loadProject(projectId);
    }
  }

  toggleArchiveProject(archive: boolean): void {
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId || this.archivingProject()) return;

    if (archive) {
      // Prompt for archive comment
      const comment = prompt(this.#translationService.instant('projects.archiveCommentPrompt'));
      // Allow null/empty comment
      this.archivingProject.set(true);
      this.#projectStore.toggleArchiveProject(projectId, archive, comment || undefined).subscribe({
        next: () => {
          this.archivingProject.set(false);
        },
        error: () => {
          this.archivingProject.set(false);
        },
      });
    } else {
      // Unarchiving doesn't need a comment
      this.archivingProject.set(true);
      this.#projectStore.toggleArchiveProject(projectId, archive).subscribe({
        next: () => {
          this.archivingProject.set(false);
        },
        error: () => {
          this.archivingProject.set(false);
        },
      });
    }
  }

  toggleProtocolsSection(): void {
    this.protocolsSectionOpen.update((v) => !v);
  }

  toggleFileListSection(): void {
    this.fileListSectionOpen.update((v) => !v);
  }

  async confirmDeleteProject(): Promise<void> {
    const projectName = this.project()?.name ?? '';
    const message = this.#translationService.instant('projects.deleteProjectConfirm', { name: projectName });
    const title = this.#translationService.instant('projects.deleteProject') || 'Delete project';
    const confirmed = await this.#modalService.openConfirm({
      title,
      message,
      confirmText: 'common.delete',
      cancelText: 'common.cancel',
      confirmKind: 'danger',
    });
    if (!confirmed) {
      return;
    }
    const projectId = this.#route.snapshot.paramMap.get('id');
    if (!projectId || this.deletingProject()) return;

    this.deletingProject.set(true);
    this.#projectStore.deleteProject(projectId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('projects.projectDeleted'),
        );
        this.deletingProject.set(false);
        this.#router.navigate(['/projects']);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('projects.deleteProjectFailed'),
        );
        this.deletingProject.set(false);
      },
    });
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
