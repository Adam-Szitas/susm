import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FileGroup,
  ProjectFile,
  FileGroupItem,
  FileSubGroup,
  fileGroupCategoryLabels,
  fileSubGroupCategoryLabels,
  applyCategoryFilterToFileGroup,
  parseMongoDateToMs,
  sortFileGroupItemsByStoredOrder,
  sortFileGroupsByStoredOrder,
  sortFileSubGroupsByStoredOrder,
  mergeVisibleReorderIntoFullOrder,
} from '@models';
import { environment } from '../../environment';
import { TranslateModule } from '@ngx-translate/core';
import { FileService } from '../../services/file.service';
import { ImageCompressionService } from '../../services/image-compression.service';
import { lockDocumentScroll, unlockDocumentScroll } from '../../services/document-scroll-lock';
import { ModalService } from '../../services/modal.service';
import { NotificationService } from '../../services/notification.service';
import { TranslationService } from '../../services/translation.service';
import { DateFormatService } from '../../services/date-format.service';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  MoveFileDestination,
  MoveFileTargetRow,
  MoveFileToGroupModalComponent,
} from './move-file-to-group-modal.component';
import {
  SubGroupUploadModalComponent,
  SubGroupUploadPayload,
} from '../sub-group-upload-modal/sub-group-upload-modal.component';
import { SubGroupDetailModalComponent } from '../sub-group-detail-modal/sub-group-detail-modal.component';
import {
  ProjectObjectOption,
  SendProjectFileModalComponent,
} from './send-project-file-modal.component';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TrashIconComponent } from '../shared/trash-icon.component';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    TrashIconComponent,
    IconComponent,
    SubGroupUploadModalComponent,
    SubGroupDetailModalComponent,
  ],
  preserveWhitespaces: false,
})
export class FileListComponent implements OnDestroy {
  protected readonly icons = icons;
  #fileService = inject(FileService);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #dateFormat = inject(DateFormatService);
  #imageCompression = inject(ImageCompressionService);

  /** Parent object id — required for uploading into an existing file group. */
  public objectId = input<string | undefined>(undefined);

  readonly groupFileInput = viewChild<ElementRef<HTMLInputElement>>('groupFileInput');
  readonly imageLightbox = viewChild<ElementRef<HTMLDialogElement>>('imageLightbox');

  /** Which group the next file-picker selection applies to (single shared input). */
  private pendingGroupUpload = signal<{ groupId: string } | null>(null);
  public groupPhotoUploading = signal(false);
  public subGroupUploadOpen = signal(false);
  public subGroupUploadUploading = signal(false);
  public subGroupUploadAddMode = signal(false);
  private subGroupUploadTarget = signal<{ groupId: string; subGroupId?: string } | null>(null);
  public subGroupDetailOpen = signal(false);
  public subGroupDetailTarget = signal<{ group: FileGroup; subGroup: FileSubGroup } | null>(null);

  /** Live sub-group from refreshed file groups while detail modal is open. */
  readonly subGroupDetailLive = computed(() => {
    const target = this.subGroupDetailTarget();
    if (!target) return null;
    const groupId = target.group._id?.$oid;
    const subGroupId = target.subGroup._id?.$oid;
    if (!groupId || !subGroupId) return target;

    const group = this.filteredFileGroups().find((g) => g._id?.$oid === groupId);
    const subGroup = group?.sub_groups?.find((sg) => sg._id?.$oid === subGroupId);
    if (!group || !subGroup) return target;
    return { group, subGroup };
  });
  public subGroupReorderSaving = signal(false);
  public draggedSubGroupId = signal<string | null>(null);
  public dragOverSubGroupId = signal<string | null>(null);

  // For object files: receives FileGroup[]
  public fileGroups = input<FileGroup[]>([]);
  /** When set, only groups matching these category labels are shown (full list kept for reorder API). */
  public categoryFilter = input<string[]>([]);
  // For project files: receives ProjectFile[]
  public projectFiles = input<ProjectFile[]>([]);
  /** Project objects available as send destinations (project tab). */
  public projectObjectOptions = input<ProjectObjectOption[]>([]);
  /** Parent object's project categories — all of these appear in the file-group category select. */
  public projectCategories = input<string[]>([]);

  constructor() {
    // Clean up failed file IDs when data changes (files that are no longer present)
    effect(() => {
      const groups = this.fileGroups();
      const projectFiles = this.projectFiles();

      // Collect all current file IDs
      const currentFileIds = new Set<string>();
      groups.forEach((group) => {
        group.files.forEach((file) => {
          const id = file._id?.$oid;
          if (id) currentFileIds.add(id);
        });
        (group.sub_groups ?? []).forEach((sg) => {
          sg.files.forEach((file) => {
            const id = file._id?.$oid;
            if (id) currentFileIds.add(id);
          });
        });
      });
      projectFiles.forEach((file) => {
        const id = file._id?.$oid;
        if (id) currentFileIds.add(id);
      });

      // Remove failed file IDs that are no longer in the current data
      // (this handles the case where files were successfully deleted and reloaded)
      this.failedFileIds.forEach((id) => {
        if (!currentFileIds.has(id)) {
          this.failedFileIds.delete(id);
        }
      });
    });

    effect(() => {
      this.filteredProjectFiles();
      this.projectFilesDisplayLimit.set(FileListComponent.PROJECT_FILES_CHUNK);
    });
  }

  /** True if the file is soft-deleted (non-null `deleted_at` timestamp). */
  private hasDeletedAt(file: FileGroupItem | ProjectFile): boolean {
    return parseMongoDateToMs((file as { deleted_at?: unknown }).deleted_at) != null;
  }

  /** True when the whole file group was soft-deleted. */
  private isGroupRemoved(group: FileGroup): boolean {
    return parseMongoDateToMs(group.deleted_at) != null;
  }

  private isSubGroupRemoved(subGroup: FileSubGroup): boolean {
    return parseMongoDateToMs(subGroup.deleted_at as unknown) != null;
  }

  // Filter failed loads & soft-deleted items; sort groups/files; optional category filter
  public filteredFileGroups = computed(() => {
    const activeGroups = sortFileGroupsByStoredOrder(
      this.fileGroups().filter((group) => !this.isGroupRemoved(group)),
    );
    const filterLabels = this.categoryFilter().map((c) => c?.trim()).filter(Boolean);
    const groups =
      filterLabels.length === 0
        ? activeGroups
        : activeGroups
            .map((g) => applyCategoryFilterToFileGroup(g, filterLabels))
            .filter((g): g is FileGroup => g != null);

    return groups.map((group) => ({
      ...group,
      files: sortFileGroupItemsByStoredOrder(
        group.files.filter(
          (file) => !this.failedFileIds.has(file._id?.$oid || '') && !this.hasDeletedAt(file),
        ),
      ),
      sub_groups: sortFileSubGroupsByStoredOrder(
        (group.sub_groups ?? []).filter((sg) => !this.isSubGroupRemoved(sg)),
      ).map((sg) => ({
        ...sg,
        files: sortFileGroupItemsByStoredOrder(
          sg.files.filter(
            (file) => !this.failedFileIds.has(file._id?.$oid || '') && !this.hasDeletedAt(file),
          ),
        ),
      })),
    }));
  });

  /** Active groups on the object (unfiltered, for group reorder API). */
  readonly activeGroupCount = computed(
    () => this.fileGroups().filter((g) => !this.isGroupRemoved(g)).length,
  );

  // Computed filtered project files (excluding failed and soft-deleted files)
  public filteredProjectFiles = computed(() => {
    return this.projectFiles().filter(
      (file) => !this.failedFileIds.has(file._id?.$oid || '') && !this.hasDeletedAt(file),
    );
  });

  private static readonly PROJECT_FILES_CHUNK = 36;
  private static readonly PROJECT_FILES_WINDOW_THRESHOLD = 48;

  /** Incremental render limit for large flat project file galleries. */
  projectFilesDisplayLimit = signal(FileListComponent.PROJECT_FILES_CHUNK);

  readonly windowedProjectFiles = computed(() => {
    const all = this.filteredProjectFiles();
    if (all.length <= FileListComponent.PROJECT_FILES_WINDOW_THRESHOLD) {
      return all;
    }
    return all.slice(0, this.projectFilesDisplayLimit());
  });

  readonly hasMoreProjectFiles = computed(
    () => this.filteredProjectFiles().length > this.windowedProjectFiles().length,
  );

  readonly remainingProjectFilesCount = computed(
    () => this.filteredProjectFiles().length - this.windowedProjectFiles().length,
  );

  readonly deferProjectFileItems = computed(
    () => this.filteredProjectFiles().length > FileListComponent.PROJECT_FILES_WINDOW_THRESHOLD,
  );

  loadMoreProjectFiles(): void {
    this.projectFilesDisplayLimit.update((count) => count + FileListComponent.PROJECT_FILES_CHUNK);
  }

  // All unique categories from file groups (for group editor checkboxes)
  public allCategories = computed(() => {
    const groups = this.filteredFileGroups();
    const cats = new Set<string>();
    groups.forEach((g) => {
      for (const c of fileGroupCategoryLabels(g)) {
        cats.add(c);
      }
    });
    return Array.from(cats).sort();
  });

  // Category options: project + used on any group + any currently selected in the editor
  public categoryOptionsForEdit = computed(() => {
    const merged = new Set<string>();
    for (const c of this.projectCategories()) {
      const t = c?.trim();
      if (t) merged.add(t);
    }
    for (const c of this.allCategories()) {
      merged.add(c);
    }
    for (const c of this.editCategories()) {
      merged.add(c);
    }
    return Array.from(merged).sort();
  });

  // All groups for move dropdown (object files only)
  public moveTargetGroups = computed(() => this.filteredFileGroups());

  public moveFileInProgress = signal(false);
  public sendProjectFilesInProgress = signal(false);

  readonly canSendProjectFiles = computed(
    () =>
      !this.objectId() &&
      this.filteredProjectFiles().length > 0 &&
      this.projectObjectOptions().length > 0,
  );

  public activeFileId = signal<string | null>(null);
  /** Full-resolution image URL when lightbox is open */
  public imageLightboxUrl = signal<string | null>(null);
  public imageLightboxAlt = signal<string>('');
  public fileDeleted = output<void>();
  public metadataUpdated = output<void>();

  // Track files that failed to load
  private failedFileIds = new Set<string>();

  // Drag-and-drop reorder (pictures within a group)
  public reorderMode = signal<boolean>(false);
  public draggedFileId = signal<string | null>(null);
  public dragOverFileId = signal<string | null>(null);
  public reorderSaving = signal<boolean>(false);

  // Reorder file groups on the object
  public groupReorderMode = signal<boolean>(false);
  public groupReorderSaving = signal<boolean>(false);

  // Inline edit state for group description/category/note
  public editingGroupId = signal<string | null>(null);
  public editDescription = signal<string>('');
  public editCategories = signal<string[]>([]);
  public categoryCustomDraft = signal<string>('');
  public editNote = signal<string>('');

  // Picture selection for moving between groups (object files only)
  public selectionMode = signal<boolean>(false);
  public selectedFileIds = signal<Set<string>>(new Set());
  public selectedMoveTargetGroupId = signal<string>('');

  // Inline edit state for single file description, filename, and created_at
  public editingFileId = signal<string | null>(null);
  public editFileDescription = signal<string>('');
  public editFileName = signal<string>('');
  public editFileCreatedAt = signal<string>('');

  public startEditGroup(group: FileGroup): void {
    if (!this.objectId()) return;
    const id = group._id?.$oid;
    if (!id) return;
    this.editingGroupId.set(id);
    this.editDescription.set(group.description ?? '');
    this.editCategories.set([...fileGroupCategoryLabels(group)]);
    this.categoryCustomDraft.set('');
    this.editNote.set(group.note ?? '');
    queueMicrotask(() => {
      const textarea = document.getElementById(`group-note-${id}`);
      if (textarea instanceof HTMLTextAreaElement) {
        this.autoResizeTextarea(textarea);
      }
    });
  }

  public onEditNoteChange(value: string, textarea: HTMLTextAreaElement): void {
    this.editNote.set(value);
    this.autoResizeTextarea(textarea);
  }

  public autoResizeTextarea(target: HTMLTextAreaElement | Event | null | undefined): void {
    const el =
      target instanceof Event ? (target.target as HTMLTextAreaElement | null) : target;
    if (!el || el.nodeName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  public isEditCategorySelected(label: string): boolean {
    return this.editCategories().some((c) => c === label);
  }

  public toggleEditCategory(label: string): void {
    const t = label.trim();
    if (!t) return;
    this.editCategories.update((list) => {
      const has = list.includes(t);
      if (has) {
        return list.filter((c) => c !== t);
      }
      return [...list, t];
    });
  }

  public addCustomCategoryFromDraft(): void {
    const t = this.categoryCustomDraft().trim();
    if (!t) return;
    this.editCategories.update((list) => (list.includes(t) ? list : [...list, t]));
    this.categoryCustomDraft.set('');
  }

  public removeEditCategory(label: string): void {
    this.editCategories.update((list) => list.filter((c) => c !== label));
  }

  public cancelEditGroup(): void {
    this.editingGroupId.set(null);
  }

  public getGroupDisplayName(group: FileGroup): string {
    const parts: string[] = [];
    if (group.description?.trim()) parts.push(group.description.trim());
    const cats = fileGroupCategoryLabels(group);
    if (cats.length > 0) parts.push(`(${cats.join(', ')})`);
    return parts.length > 0 ? parts.join(' ') : `Group ${group._id?.$oid?.slice(-6) || ''}`;
  }

  public groupCategoryLabels = fileGroupCategoryLabels;
  public subGroupCategoryLabels = fileSubGroupCategoryLabels;

  /** Four fixed slots for the sub-group tile collage (2×2). */
  public subGroupPreviewSlots(
    subGroup: FileSubGroup,
  ): Array<{ index: number; file?: FileGroupItem }> {
    const files = subGroup.files.slice(0, 4);
    return Array.from({ length: 4 }, (_, index) => ({
      index,
      file: files[index],
    }));
  }

  /** Build move destinations for a file (root or inside a sub-group). */
  public buildMoveTargetsForFile(
    currentGroup: FileGroup,
    sourceSubGroupId?: string,
  ): MoveFileTargetRow[] {
    const currentGroupId = currentGroup._id?.$oid;
    if (!currentGroupId) return [];

    const rows: MoveFileTargetRow[] = [];

    for (const g of this.filteredFileGroups()) {
      const groupId = g._id?.$oid;
      if (!groupId) continue;

      const activeSubGroups = (g.sub_groups ?? [])
        .filter((sg) => !this.isSubGroupRemoved(sg))
        .map((sg) => {
          const sid = sg._id?.$oid;
          if (!sid) return null;
          if (groupId === currentGroupId && sid === sourceSubGroupId) return null;
          return {
            subGroupId: sid,
            label: sg.name?.trim() || sid.slice(-6),
          };
        })
        .filter((s): s is { subGroupId: string; label: string } => s !== null);

      const isCurrentGroup = groupId === currentGroupId;
      const groupLabel = this.getGroupDisplayName(g);

      if (isCurrentGroup) {
        if (sourceSubGroupId) {
          rows.push({
            groupId,
            label: `${groupLabel} (${this.#translationService.instant('subGroups.groupRoot')})`,
            includeGroupRoot: true,
          });
        }
        if (activeSubGroups.length > 0) {
          rows.push({
            groupId,
            label: groupLabel,
            subGroups: activeSubGroups,
          });
        }
      } else {
        rows.push({
          groupId,
          label: groupLabel,
          includeGroupRoot: true,
          subGroups: activeSubGroups.length ? activeSubGroups : undefined,
        });
      }
    }

    return rows;
  }

  public hasMoveTargetsForFile(currentGroup: FileGroup, sourceSubGroupId?: string): boolean {
    return this.buildMoveTargetsForFile(currentGroup, sourceSubGroupId).length > 0;
  }

  public toggleFileSelection(file: FileGroupItem | ProjectFile, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    const id = file._id?.$oid;
    if (!id) return;
    this.selectedFileIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  public isFileSelected(file: FileGroupItem | ProjectFile): boolean {
    return this.selectedFileIds().has(file._id?.$oid || '');
  }

  public clearSelection(): void {
    this.selectedFileIds.set(new Set());
    this.selectionMode.set(false);
    this.selectedMoveTargetGroupId.set('');
  }

  /** Other file groups on this object (for moving a single picture from the overlay). */
  public moveTargetsExcludingGroup(group: FileGroup): FileGroup[] {
    const id = group._id?.$oid;
    if (!id) return [];
    return this.filteredFileGroups().filter((g) => g._id?.$oid && g._id.$oid !== id);
  }

  /** Open modal to pick destination; then move this file. */
  public openMoveFileModal(
    event: Event,
    file: FileGroupItem,
    currentGroup: FileGroup,
    sourceSubGroupId?: string,
  ): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.moveFileInProgress()) return;

    const targetRows = this.buildMoveTargetsForFile(currentGroup, sourceSubGroupId);
    if (targetRows.length === 0) return;

    this.activeFileId.set(null);

    const { childRef } = this.#modalService.open({
      title: 'fileList.movePickDestination',
      component: MoveFileToGroupModalComponent,
      componentInputs: { targetRows },
      wide: true,
    });

    if (childRef) {
      const inst = childRef.instance as MoveFileToGroupModalComponent;
      const sub = inst.destinationPicked.subscribe((dest: MoveFileDestination) => {
        sub.unsubscribe();
        this.#moveFileToGroup(file, dest.groupId, dest.subGroupId);
      });
    }
  }

  #moveFileToGroup(file: FileGroupItem, targetGroupId: string, targetSubGroupId?: string): void {
    const fileId = file._id?.$oid;
    if (!fileId || this.moveFileInProgress()) return;

    this.moveFileInProgress.set(true);
    this.#fileService
      .moveFileToGroup(fileId, targetGroupId, targetSubGroupId ?? null)
      .pipe(finalize(() => this.moveFileInProgress.set(false)))
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('fileList.moveSuccess', { count: 1 }) ||
              'Picture moved',
          );
          this.metadataUpdated.emit();
        },
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message ||
              this.#translationService.instant('fileList.moveFailed') ||
              'Failed to move file',
          );
        },
      });
  }

  public openSendProjectFilesModal(fileIds?: string[]): void {
    if (!this.canSendProjectFiles() || this.sendProjectFilesInProgress()) return;

    const ids =
      fileIds && fileIds.length > 0 ? fileIds : Array.from(this.selectedFileIds());
    if (ids.length === 0) return;

    this.activeFileId.set(null);

    const { childRef } = this.#modalService.open({
      title: 'fileList.sendToObject',
      component: SendProjectFileModalComponent,
      componentInputs: {
        objectOptions: this.projectObjectOptions(),
        fileCount: ids.length,
      },
      wide: true,
    });

    if (childRef) {
      const inst = childRef.instance as SendProjectFileModalComponent;
      const sub = inst.destinationConfirmed.subscribe((dest) => {
        sub.unsubscribe();
        this.#sendProjectFilesToGroup(ids, dest.objectId, dest.groupId);
      });
    }
  }

  public openSendProjectFileModal(event: Event, file: ProjectFile): void {
    event.stopPropagation();
    event.preventDefault();
    const id = file._id?.$oid;
    if (!id) return;
    this.openSendProjectFilesModal([id]);
  }

  #sendProjectFilesToGroup(
    fileIds: string[],
    objectId: string,
    groupId: string,
  ): void {
    if (!fileIds.length || this.sendProjectFilesInProgress()) return;

    this.sendProjectFilesInProgress.set(true);
    let completed = 0;
    const total = fileIds.length;

    const sendNext = () => {
      if (completed >= total) {
        this.sendProjectFilesInProgress.set(false);
        this.#notificationService.showSuccess(
          this.#translationService.instant('fileList.moveSuccess', { count: total }) ||
            `Moved ${total} picture(s) to object`,
        );
        this.clearSelection();
        this.metadataUpdated.emit();
        return;
      }

      const fileId = fileIds[completed];
      this.#fileService
        .sendProjectFileToGroup(fileId, objectId, groupId)
        .pipe(finalize(() => {}))
        .subscribe({
          next: () => {
            completed++;
            sendNext();
          },
          error: (error: Error) => {
            this.sendProjectFilesInProgress.set(false);
            this.#notificationService.showError(
              error.message ||
                this.#translationService.instant('fileList.moveFailed') ||
                'Failed to move picture',
            );
            this.clearSelection();
            this.metadataUpdated.emit();
          },
        });
    };

    sendNext();
  }

  public moveSelectedToGroup(targetGroupId?: string): void {
    const id = targetGroupId ?? this.selectedMoveTargetGroupId();
    if (!id) return;
    const ids = Array.from(this.selectedFileIds());
    if (ids.length === 0) return;

    let completed = 0;
    const total = ids.length;
    const groupId = id;
    const moveNext = () => {
      if (completed >= total) {
        this.#notificationService.showSuccess(
          this.#translationService.instant('fileList.moveSuccess', { count: total }) ||
            `Moved ${total} file(s) successfully`,
        );
        this.clearSelection();
        this.metadataUpdated.emit();
        return;
      }
      const fileId = ids[completed];
      this.#fileService.moveFileToGroup(fileId, groupId).subscribe({
        next: () => {
          completed++;
          moveNext();
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message ||
              this.#translationService.instant('fileList.moveFailed') ||
              'Failed to move file',
          );
          this.clearSelection();
          this.metadataUpdated.emit();
        },
      });
    };
    moveNext();
  }

  public openGroupPhotoPicker(group: FileGroup): void {
    const groupId = group._id?.$oid;
    const objectId = this.objectId();
    if (!groupId || !objectId || this.groupPhotoUploading()) {
      return;
    }
    this.pendingGroupUpload.set({ groupId });
    // Must stay in the same synchronous user-gesture stack (esp. iOS Safari) — no microtask/setTimeout.
    this.groupFileInput()?.nativeElement?.click();
  }

  public async onGroupPhotoFilesSelected(event: Event): Promise<void> {
    const pending = this.pendingGroupUpload();
    const objectId = this.objectId();
    const input = event.target as HTMLInputElement;

    // Read and copy files BEFORE clearing `value` — clearing resets `files` (desktop + mobile).
    const files = input.files?.length ? Array.from(input.files) : [];
    input.value = '';

    if (!pending || !objectId || this.groupPhotoUploading()) {
      this.pendingGroupUpload.set(null);
      return;
    }

    if (files.length === 0) {
      this.pendingGroupUpload.set(null);
      return;
    }
    const imageFiles = files.filter((f) => this.#imageCompression.isImageFile(f));
    if (imageFiles.length === 0) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.imageCompressionFailed') ||
          'Please select image files only',
      );
      this.pendingGroupUpload.set(null);
      return;
    }

    const groupId = pending.groupId;
    this.pendingGroupUpload.set(null);

    try {
      const compressed = await this.#imageCompression.compressImages(imageFiles);
      this.uploadPhotosToGroup(objectId, groupId, compressed);
    } catch (err) {
      this.#notificationService.showError(
        err instanceof Error
          ? err.message
          : this.#translationService.instant('errors.imageCompressionFailed'),
      );
    }
  }

  private uploadPhotosToGroup(objectId: string, groupId: string, files: File[]): void {
    this.groupPhotoUploading.set(true);
    const form = new FormData();
    files.forEach((file) => {
      form.append('avatar', file, file.name);
    });

    this.#fileService
      .uploadFileForObject(form, objectId, {
        groupId,
        files,
      })
      .pipe(finalize(() => this.groupPhotoUploading.set(false)))
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('objects.uploadSuccess') || 'Upload successful',
          );
          this.metadataUpdated.emit();
        },
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message ||
              this.#translationService.instant('errors.uploadFailed') ||
              'Upload failed',
          );
        },
      });
  }

  public openSubGroupUploadModal(group: FileGroup): void {
    const groupId = group._id?.$oid;
    if (!groupId || !this.objectId() || this.subGroupUploadUploading()) {
      return;
    }
    this.subGroupUploadAddMode.set(false);
    this.subGroupUploadTarget.set({ groupId });
    this.subGroupUploadOpen.set(true);
  }

  public openSubGroupAddPhotosModal(group: FileGroup, subGroup: FileSubGroup): void {
    const groupId = group._id?.$oid;
    const subGroupId = subGroup._id?.$oid;
    if (!groupId || !subGroupId || !this.objectId() || this.subGroupUploadUploading()) {
      return;
    }
    this.subGroupUploadAddMode.set(true);
    this.subGroupUploadTarget.set({ groupId, subGroupId });
    this.subGroupUploadOpen.set(true);
  }

  public onSubGroupUploadCancel(): void {
    this.subGroupUploadOpen.set(false);
    this.subGroupUploadTarget.set(null);
    this.subGroupUploadAddMode.set(false);
  }

  public onSubGroupUpload(payload: SubGroupUploadPayload): void {
    const target = this.subGroupUploadTarget();
    if (!target || this.subGroupUploadUploading()) {
      return;
    }

    if (this.subGroupUploadAddMode() && target.subGroupId) {
      this.subGroupUploadUploading.set(true);
      this.#fileService
        .addFilesToSubGroup(target.subGroupId, payload.files)
        .pipe(finalize(() => this.subGroupUploadUploading.set(false)))
        .subscribe({
          next: () => {
            this.#notificationService.showSuccess(
              this.#translationService.instant('subGroups.addPhotosSuccess'),
            );
            this.onSubGroupUploadCancel();
            this.metadataUpdated.emit();
          },
          error: (error: Error) => {
            this.#notificationService.showError(
              error.message || this.#translationService.instant('subGroups.uploadFailed'),
            );
          },
        });
      return;
    }

    if (!payload.name.trim()) {
      this.#notificationService.showError(
        this.#translationService.instant('subGroups.nameRequired'),
      );
      return;
    }

    this.subGroupUploadUploading.set(true);
    this.#fileService
      .createSubGroupWithUpload(target.groupId, payload.files, {
        name: payload.name,
        categories: payload.categories,
        note: payload.note,
      })
      .pipe(finalize(() => this.subGroupUploadUploading.set(false)))
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('subGroups.createSuccess'),
          );
          this.onSubGroupUploadCancel();
          this.metadataUpdated.emit();
        },
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('subGroups.uploadFailed'),
          );
        },
      });
  }

  public openSubGroupDetail(group: FileGroup, subGroup: FileSubGroup): void {
    if (this.groupReorderMode() || this.reorderMode()) {
      return;
    }
    this.subGroupDetailTarget.set({ group, subGroup });
    this.subGroupDetailOpen.set(true);
  }

  /** Opens detail when the user clicks anywhere on the sub-group tile (not after drag). */
  public onSubGroupItemClick(
    _event: MouseEvent,
    group: FileGroup,
    subGroup: FileSubGroup,
  ): void {
    if (this.subGroupDidDrag) {
      this.subGroupDidDrag = false;
      return;
    }
    this.openSubGroupDetail(group, subGroup);
  }

  public onSubGroupItemKeyActivate(
    event: Event,
    group: FileGroup,
    subGroup: FileSubGroup,
  ): void {
    event.preventDefault();
    this.openSubGroupDetail(group, subGroup);
  }

  private subGroupDidDrag = false;

  public onSubGroupDetailClosed(): void {
    this.subGroupDetailOpen.set(false);
    this.subGroupDetailTarget.set(null);
  }

  public onSubGroupDetailAddPhotos(): void {
    const target = this.subGroupDetailLive() ?? this.subGroupDetailTarget();
    if (!target) return;
    this.openSubGroupAddPhotosModal(target.group, target.subGroup);
  }

  public subGroupUploadInitialName(): string {
    const target = this.subGroupUploadTarget();
    if (!target?.subGroupId) return '';
    const group = this.fileGroups().find((g) => g._id?.$oid === target.groupId);
    const sg = group?.sub_groups?.find((s) => s._id?.$oid === target.subGroupId);
    return sg?.name ?? '';
  }

  public subGroupUploadInitialCategories(): string[] {
    const target = this.subGroupUploadTarget();
    if (!target?.subGroupId) return [];
    const group = this.fileGroups().find((g) => g._id?.$oid === target.groupId);
    const sg = group?.sub_groups?.find((s) => s._id?.$oid === target.subGroupId);
    return sg ? fileSubGroupCategoryLabels(sg) : [];
  }

  public subGroupUploadInitialNote(): string {
    const target = this.subGroupUploadTarget();
    if (!target?.subGroupId) return '';
    const group = this.fileGroups().find((g) => g._id?.$oid === target.groupId);
    const sg = group?.sub_groups?.find((s) => s._id?.$oid === target.subGroupId);
    return sg?.note ?? '';
  }

  #subGroupOrderIds(group: FileGroup): string[] {
    const raw = this.fileGroups().find((g) => g._id.$oid === group._id.$oid);
    if (!raw) return [];
    return sortFileSubGroupsByStoredOrder((raw.sub_groups ?? []).filter((sg) => !this.isSubGroupRemoved(sg)))
      .map((sg) => sg._id?.$oid)
      .filter((id): id is string => !!id);
  }

  public onSubGroupDragStart(event: DragEvent, subGroup: FileSubGroup): void {
    this.subGroupDidDrag = false;
    if (this.subGroupReorderSaving()) {
      event.preventDefault();
      return;
    }
    const id = subGroup._id?.$oid;
    if (!id) return;
    this.draggedSubGroupId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  public onSubGroupDragOver(event: DragEvent, subGroup: FileSubGroup): void {
    event.preventDefault();
    if (this.draggedSubGroupId()) {
      this.subGroupDidDrag = true;
    }
    const id = subGroup._id?.$oid;
    if (id && id !== this.draggedSubGroupId()) {
      this.dragOverSubGroupId.set(id);
    }
  }

  public onSubGroupDragLeave(_event: DragEvent, subGroup: FileSubGroup): void {
    const id = subGroup._id?.$oid;
    if (id && this.dragOverSubGroupId() === id) {
      this.dragOverSubGroupId.set(null);
    }
  }

  public onSubGroupDrop(event: DragEvent, targetSubGroup: FileSubGroup, group: FileGroup): void {
    event.preventDefault();
    if (this.subGroupReorderSaving()) return;

    const draggedId = this.draggedSubGroupId();
    const targetId = targetSubGroup._id?.$oid;
    const groupId = group._id?.$oid;
    if (!draggedId || !targetId || !groupId || draggedId === targetId) {
      this.draggedSubGroupId.set(null);
      this.dragOverSubGroupId.set(null);
      return;
    }

    const order = this.#subGroupOrderIds(group);
    const fromIndex = order.indexOf(draggedId);
    const toIndex = order.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const after = [...order];
    after.splice(fromIndex, 1);
    after.splice(toIndex, 0, draggedId);

    this.draggedSubGroupId.set(null);
    this.dragOverSubGroupId.set(null);
    this.#saveSubGroupOrder(groupId, after);
  }

  public onSubGroupDragEnd(): void {
    this.draggedSubGroupId.set(null);
    this.dragOverSubGroupId.set(null);
  }

  public moveSubGroupUp(subGroup: FileSubGroup, group: FileGroup): void {
    if (this.subGroupReorderSaving()) return;
    const groupId = group._id?.$oid;
    if (!groupId) return;
    const order = [...this.#subGroupOrderIds(group)];
    const id = subGroup._id?.$oid;
    const index = id ? order.indexOf(id) : -1;
    if (index <= 0) return;
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    this.#saveSubGroupOrder(groupId, order);
  }

  public moveSubGroupDown(subGroup: FileSubGroup, group: FileGroup): void {
    if (this.subGroupReorderSaving()) return;
    const groupId = group._id?.$oid;
    if (!groupId) return;
    const order = [...this.#subGroupOrderIds(group)];
    const id = subGroup._id?.$oid;
    const index = id ? order.indexOf(id) : -1;
    if (index === -1 || index >= order.length - 1) return;
    [order[index], order[index + 1]] = [order[index + 1], order[index]];
    this.#saveSubGroupOrder(groupId, order);
  }

  #saveSubGroupOrder(groupId: string, subGroupIds: string[]): void {
    if (this.subGroupReorderSaving()) return;
    this.subGroupReorderSaving.set(true);
    this.#fileService
      .reorderSubGroups(groupId, subGroupIds)
      .pipe(finalize(() => this.subGroupReorderSaving.set(false)))
      .subscribe({
        next: () => this.metadataUpdated.emit(),
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('subGroups.reorderFailed'),
          );
        },
      });
  }

  public saveGroupMetadata(group: FileGroup): void {
    if (!this.objectId()) return;
    const id = group._id?.$oid;
    if (!id) return;

    const description = this.editDescription().trim();
    const categories = this.editCategories()
      .map((c) => c.trim())
      .filter(Boolean);
    const unique = [...new Set(categories)];
    const noteRaw = this.editNote().trim();
    const note = noteRaw === '' ? null : noteRaw;

    this.#fileService
      .updateFileGroup(id, {
        description,
        categories: unique,
        note,
      })
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('fileList.updateMetadataSuccess') ||
              'Group updated successfully',
          );
          this.editingGroupId.set(null);
          this.metadataUpdated.emit();
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message ||
              this.#translationService.instant('fileList.updateMetadataFailed') ||
              'Failed to update group',
          );
        },
      });
  }

  public startEditFile(file: FileGroupItem | ProjectFile): void {
    const id = file._id?.$oid;
    if (!id) return;
    this.editingFileId.set(id);
    this.editFileDescription.set(file.description || '');
    this.editFileName.set(file.filename || '');

    // Date input uses UTC calendar day (matches protocol filter / PDF picture_date).
    let dateValue = '';
    if (file.created_at != null) {
      const ms = parseMongoDateToMs(file.created_at as unknown);
      if (ms != null) {
        const d = new Date(ms);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        dateValue = `${year}-${month}-${day}`;
      }
    }

    this.editFileCreatedAt.set(dateValue);
  }

  public cancelEditFile(): void {
    this.editingFileId.set(null);
  }

  public saveFileMetadata(file: FileGroupItem | ProjectFile): void {
    const id = file._id?.$oid;
    if (!id) return;

    const description = this.editFileDescription().trim();
    const filename = this.editFileName().trim();
    const createdAtRaw = this.editFileCreatedAt().trim();

    // Convert date string to ISO 8601 format (RFC3339) for backend
    // Backend expects format like "2026-01-01T00:00:00Z"
    let createdAt: string | undefined = undefined;
    if (createdAtRaw) {
      // Date input returns YYYY-MM-DD format
      // Parse it explicitly to avoid timezone issues
      const [year, month, day] = createdAtRaw.split('-').map(Number);
      if (year && month && day) {
        // Create date in UTC to avoid timezone conversion issues
        const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
        if (!isNaN(date.getTime())) {
          createdAt = date.toISOString();
        }
      }
    }

    // Always send description (even when empty) so the backend persists removals
    this.#fileService
      .updateFileMetadata(id, {
        description,
        filename: filename || undefined,
        created_at: createdAt,
      })
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('fileList.updateMetadataSuccess') ||
              'File updated successfully',
          );
          this.editingFileId.set(null);
          this.metadataUpdated.emit();
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message ||
              this.#translationService.instant('fileList.updateMetadataFailed') ||
              'Failed to update file',
          );
        },
      });
  }

  /**
   * Formats picture date for display (UTC calendar day, consistent with protocol PDF).
   */
  public getCreatedAtDisplay(file: FileGroupItem | ProjectFile): string | null {
    const ms = parseMongoDateToMs(file.created_at as unknown);
    if (ms === null) return null;
    const formatted = this.#dateFormat.formatUtcDate(ms);
    return formatted || null;
  }

  public getImageUrl(path: string): string {
    // Normalize: strip leading . / and \, then backslashes to slashes (handles Windows paths)
    let normalizedPath = path.replace(/^[.\\/]+/, '').replace(/\\/g, '/');
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      const encodedPath = encodeURIComponent(normalizedPath);
      return `${environment.be}${environment.folderBase}/${encodedPath}`;
    }
    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring('uploads/'.length);
    }
    const pathSegments = normalizedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment));
    const encodedPath = pathSegments.join('/');
    return `${environment.be}${environment.folderBase}/${encodedPath}`;
  }

  /**
   * First tap opens actions; tap image/backdrop again closes. Buttons only fire when overlay is open.
   */
  public onImageContainerClick(event: MouseEvent, file: FileGroupItem | ProjectFile): void {
    if (this.reorderMode() || this.groupReorderMode()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this.selectionMode()) {
      this.toggleFileSelection(file, event);
      return;
    }

    const id = file._id?.$oid;
    if (!id) return;

    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }

    event.stopPropagation();

    if (this.activeFileId() === id) {
      this.hideOverlay();
    } else {
      this.activeFileId.set(id);
    }
  }

  public hideOverlay(): void {
    this.activeFileId.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscapeCloseLightbox(): void {
    // Native <dialog> handles Escape when open via showModal(); keep as fallback
    // for any non-dialog overlay state.
    if (this.imageLightboxUrl() && !this.imageLightbox()?.nativeElement?.open) {
      this.closeImageLightbox();
    }
  }

  ngOnDestroy(): void {
    this.#restoreBodyScroll();
  }

  #lockBodyScroll(): void {
    lockDocumentScroll();
  }

  #restoreBodyScroll(): void {
    unlockDocumentScroll();
  }

  public openImageLightbox(event: Event, file: FileGroupItem | ProjectFile): void {
    event.stopPropagation();
    event.preventDefault();
    this.imageLightboxUrl.set(this.getImageUrl(file.path));
    this.imageLightboxAlt.set(file.filename || '');
    this.activeFileId.set(null);
    const dialog = this.imageLightbox()?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    this.#lockBodyScroll();
  }

  public closeImageLightbox(): void {
    const dialog = this.imageLightbox()?.nativeElement;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    this.#clearImageLightboxState();
  }

  public onImageLightboxDialogClose(): void {
    this.#clearImageLightboxState();
  }

  public onImageLightboxBackdropClick(event: MouseEvent): void {
    const dialog = event.currentTarget as HTMLDialogElement;
    // Fallback for browsers without closedby support: click on the dialog backdrop area.
    if (event.target === dialog) {
      dialog.close();
    }
  }

  #clearImageLightboxState(): void {
    this.imageLightboxUrl.set(null);
    this.imageLightboxAlt.set('');
    this.#restoreBodyScroll();
  }

  public handleOverlayDownload(event: Event, path: string, filename?: string): void {
    event.stopPropagation();
    event.preventDefault();
    this.downloadFile(path, filename);
  }

  public handleOverlayDelete(event: Event, file: FileGroupItem | ProjectFile): void {
    event.stopPropagation();
    event.preventDefault();
    this.deleteFile(file);
  }

  public downloadFile(path: string, filename?: string): void {
    // Normalize: strip leading . / and \, then backslashes to slashes (handles Windows paths)
    let normalizedPath = path.replace(/^[.\\/]+/, '').replace(/\\/g, '/');
    let url: string;
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      const encodedPath = encodeURIComponent(normalizedPath);
      url = `${environment.be}${environment.folderBase}/${encodedPath}`;
    } else {
      if (normalizedPath.startsWith('uploads/')) {
        normalizedPath = normalizedPath.substring('uploads/'.length);
      }
      const pathSegments = normalizedPath
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment));
      const encodedPath = pathSegments.join('/');
      url = `${environment.be}${environment.folderBase}/${encodedPath}`;
    }

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    const downloadFilename = filename || path.split(/[\\/]/).pop() || 'file';
    link.download = downloadFilename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public async deleteFileGroup(group: FileGroup): Promise<void> {
    const groupId = group._id?.$oid;
    if (!groupId || !this.objectId()) {
      this.#notificationService.showError(
        this.#translationService.instant('fileList.deleteFileGroupFailed') || 'Invalid group',
      );
      return;
    }

    const groupLabel = this.getGroupDisplayName(group);
    let message = this.#translationService.instant('fileList.confirmDeleteFileGroup', { groupLabel });
    if (message === 'fileList.confirmDeleteFileGroup') {
      message = `Remove the file group "${groupLabel}"? The group will be hidden; files remain on the server.`;
    }
    const title =
      this.#translationService.instant('fileList.deleteFileGroup') || 'Remove file group';

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

    this.#fileService.deleteFileGroup(groupId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('fileList.deleteFileGroupSuccess') ||
            'File group removed',
        );
        this.fileDeleted.emit();
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message ||
            this.#translationService.instant('fileList.deleteFileGroupFailed') ||
            'Failed to remove file group',
        );
      },
    });
  }

  public async deleteFile(file: FileGroupItem | ProjectFile): Promise<void> {
    const fileId = file._id?.$oid;
    if (!fileId) {
      this.#notificationService.showError(
        this.#translationService.instant('fileList.deleteFailed') || 'Invalid file ID',
      );
      return;
    }

    const fileName = file.filename || file.path?.split(/[\\/]/).pop() || 'file';
    let confirmMessage = this.#translationService.instant('fileList.confirmDelete', { fileName });
    if (confirmMessage === 'fileList.confirmDelete') {
      confirmMessage = `Are you sure you want to delete "${fileName}"?`;
    }
    const title = this.#translationService.instant('fileList.deleteFile') || 'Delete file';

    const confirmed = await this.#modalService.openConfirm({
      title,
      message: confirmMessage,
      confirmText: 'common.delete',
      cancelText: 'common.cancel',
      confirmKind: 'danger',
    });
    if (!confirmed) {
      this.#notificationService.showInfo('File deletion cancelled');
      return;
    }

    // Mark as failed immediately to hide it from UI
    this.failedFileIds.add(fileId);

    this.#fileService.deleteFile(fileId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('fileList.deleteSuccess') || 'File deleted successfully',
        );
        this.fileDeleted.emit();
      },
      error: (error) => {
        // Remove from failed list if deletion failed (so it can be shown again)
        this.failedFileIds.delete(fileId);
        this.#notificationService.showError(
          error.message ||
            this.#translationService.instant('fileList.deleteFailed') ||
            'Failed to delete file',
        );
      },
    });
  }

  public onImageError(file: FileGroupItem | ProjectFile, event: Event): void {
    const fileId = file._id?.$oid;
    if (fileId) {
      // Mark file as failed to load
      this.failedFileIds.add(fileId);
      // Hide the image element
      const img = event.target as HTMLImageElement;
      if (img) {
        img.style.display = 'none';
      }
    }
  }

  // =========================================================================
  // Drag-and-drop reorder
  // =========================================================================

  public toggleReorderMode(): void {
    const turningOn = !this.reorderMode();
    this.reorderMode.update((v) => !v);
    if (turningOn) {
      this.groupReorderMode.set(false);
      this.hideOverlay();
      this.clearSelection();
    } else {
      this.draggedFileId.set(null);
      this.dragOverFileId.set(null);
    }
  }

  public toggleGroupReorderMode(): void {
    const turningOn = !this.groupReorderMode();
    this.groupReorderMode.update((v) => !v);
    if (turningOn) {
      this.reorderMode.set(false);
      this.draggedFileId.set(null);
      this.dragOverFileId.set(null);
      this.hideOverlay();
      this.clearSelection();
    }
  }

  /** All active group IDs in stored order (includes groups hidden by category filter). */
  #allActiveGroupIds(): string[] {
    return sortFileGroupsByStoredOrder(this.fileGroups().filter((g) => !this.isGroupRemoved(g)))
      .map((g) => g._id?.$oid)
      .filter((id): id is string => !!id);
  }

  /** Group IDs currently shown in the UI (after category filter). */
  #visibleGroupIds(): string[] {
    return this.filteredFileGroups()
      .map((g) => g._id?.$oid)
      .filter((id): id is string => !!id);
  }

  #saveVisibleGroupReorder(visibleOrderAfter: string[]): void {
    const objectId = this.objectId();
    if (!objectId) return;

    const fullBefore = this.#allActiveGroupIds();
    const visibleBefore = this.#visibleGroupIds();
    if (!fullBefore.length || !visibleBefore.length) return;

    const merged = mergeVisibleReorderIntoFullOrder(
      fullBefore,
      visibleBefore,
      visibleOrderAfter,
    );
    this.#saveGroupOrder(objectId, merged);
  }

  public moveGroupUp(group: FileGroup): void {
    if (this.groupReorderSaving()) return;
    const visible = [...this.#visibleGroupIds()];
    const id = group._id?.$oid;
    if (!id) return;
    const index = visible.indexOf(id);
    if (index <= 0) return;
    [visible[index - 1], visible[index]] = [visible[index], visible[index - 1]];
    this.#saveVisibleGroupReorder(visible);
  }

  public moveGroupDown(group: FileGroup): void {
    if (this.groupReorderSaving()) return;
    const visible = [...this.#visibleGroupIds()];
    const id = group._id?.$oid;
    if (!id) return;
    const index = visible.indexOf(id);
    if (index === -1 || index >= visible.length - 1) return;
    [visible[index], visible[index + 1]] = [visible[index + 1], visible[index]];
    this.#saveVisibleGroupReorder(visible);
  }

  #saveGroupOrder(objectId: string, groupIds: string[]): void {
    if (this.groupReorderSaving()) return;
    this.groupReorderSaving.set(true);
    this.#fileService
      .reorderFileGroups(objectId, groupIds)
      .pipe(finalize(() => this.groupReorderSaving.set(false)))
      .subscribe({
        next: () => {
          this.metadataUpdated.emit();
        },
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message ||
              this.#translationService.instant('fileList.groupOrderSaveFailed'),
          );
        },
      });
  }

  /** Files shown in the gallery (excludes broken thumbnails). */
  #visibleFilesInGroup(group: FileGroup): FileGroupItem[] {
    return (
      this.filteredFileGroups().find((g) => g._id.$oid === group._id.$oid)?.files ?? []
    );
  }

  /** Visible file IDs in display order. */
  #visibleFileOrderIds(group: FileGroup): string[] {
    return this.#visibleFilesInGroup(group)
      .map((f) => f._id?.$oid)
      .filter((id): id is string => !!id);
  }

  /** Active files in storage order (includes broken thumbnails — required for reorder API). */
  #activeFilesForReorder(group: FileGroup): FileGroupItem[] {
    const raw = this.fileGroups().find((g) => g._id.$oid === group._id.$oid);
    if (!raw) return [];
    return sortFileGroupItemsByStoredOrder(raw.files.filter((f) => !this.hasDeletedAt(f)));
  }

  /** Ordered file IDs sent to the reorder API (every active file in the group). */
  #fileOrderIdsForGroup(group: FileGroup): string[] {
    return this.#activeFilesForReorder(group)
      .map((f) => f._id?.$oid)
      .filter((id): id is string => !!id);
  }

  /** Apply a visible-only reorder and merge hidden files back into their original slots. */
  #saveVisibleReorder(group: FileGroup, visibleOrderAfter: string[]): void {
    const fullBefore = this.#fileOrderIdsForGroup(group);
    const visibleBefore = this.#visibleFileOrderIds(group);
    if (!fullBefore.length || !visibleBefore.length) return;

    const merged = mergeVisibleReorderIntoFullOrder(
      fullBefore,
      visibleBefore,
      visibleOrderAfter,
    );
    this.#saveFileOrder(group._id.$oid, merged);
  }

  public onDragStart(event: DragEvent, file: FileGroupItem): void {
    if (this.reorderSaving()) {
      event.preventDefault();
      return;
    }
    const id = file._id?.$oid;
    if (!id) return;
    this.draggedFileId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  public onDragOver(event: DragEvent, file: FileGroupItem): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const id = file._id?.$oid;
    if (id && id !== this.draggedFileId()) {
      this.dragOverFileId.set(id);
    }
  }

  public onDragLeave(event: DragEvent, file: FileGroupItem): void {
    const id = file._id?.$oid;
    if (id && this.dragOverFileId() === id) {
      this.dragOverFileId.set(null);
    }
  }

  public onDrop(event: DragEvent, targetFile: FileGroupItem, group: FileGroup): void {
    event.preventDefault();
    if (this.reorderSaving()) return;

    const draggedId = this.draggedFileId();
    const targetId = targetFile._id?.$oid;
    if (!draggedId || !targetId || draggedId === targetId) {
      this.draggedFileId.set(null);
      this.dragOverFileId.set(null);
      return;
    }

    const visibleBefore = this.#visibleFileOrderIds(group);
    if (!visibleBefore.length) return;

    const fromIndex = visibleBefore.indexOf(draggedId);
    const toIndex = visibleBefore.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const visibleAfter = [...visibleBefore];
    visibleAfter.splice(fromIndex, 1);
    visibleAfter.splice(toIndex, 0, draggedId);

    this.draggedFileId.set(null);
    this.dragOverFileId.set(null);

    this.#saveVisibleReorder(group, visibleAfter);
  }

  public onDragEnd(): void {
    this.draggedFileId.set(null);
    this.dragOverFileId.set(null);
  }

  /** Move file one position earlier (left/up) in the group. */
  public moveFileUp(file: FileGroupItem, group: FileGroup): void {
    if (this.reorderSaving()) return;
    const visible = [...this.#visibleFileOrderIds(group)];
    const index = visible.indexOf(file._id.$oid);
    if (index <= 0) return;

    [visible[index - 1], visible[index]] = [visible[index], visible[index - 1]];
    this.#saveVisibleReorder(group, visible);
  }

  /** Move file one position later (right/down) in the group. */
  public moveFileDown(file: FileGroupItem, group: FileGroup): void {
    if (this.reorderSaving()) return;
    const visible = [...this.#visibleFileOrderIds(group)];
    const index = visible.indexOf(file._id.$oid);
    if (index === -1 || index >= visible.length - 1) return;

    [visible[index], visible[index + 1]] = [visible[index + 1], visible[index]];
    this.#saveVisibleReorder(group, visible);
  }

  #saveFileOrder(groupId: string, fileIds: string[]): void {
    if (this.reorderSaving()) return;
    this.reorderSaving.set(true);
    this.#fileService.reorderFiles(groupId, fileIds).pipe(
      finalize(() => this.reorderSaving.set(false)),
    ).subscribe({
      next: () => {
        this.metadataUpdated.emit();
      },
      error: (error: Error) => {
        this.#notificationService.showError(
          error.message || 'Failed to save file order',
        );
      },
    });
  }
}
