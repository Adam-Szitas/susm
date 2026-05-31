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
  fileGroupCategoryLabels,
  parseMongoDateToMs,
  sortFileGroupItemsByStoredOrder,
  sortFileGroupsByStoredOrder,
  mergeVisibleReorderIntoFullOrder,
} from '@models';
import { environment } from '../../environment';
import { TranslateModule } from '@ngx-translate/core';
import { FileService } from '../../services/file.service';
import { ImageCompressionService } from '../../services/image-compression.service';
import { ModalService } from '../../services/modal.service';
import { NotificationService } from '../../services/notification.service';
import { TranslationService } from '../../services/translation.service';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { MoveFileToGroupModalComponent } from './move-file-to-group-modal.component';
import { TrashIconComponent } from '../shared/trash-icon.component';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, TrashIconComponent],
  preserveWhitespaces: false,
})
export class FileListComponent implements OnDestroy {
  #fileService = inject(FileService);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #imageCompression = inject(ImageCompressionService);

  /** Parent object id — required for uploading into an existing file group. */
  public objectId = input<string | undefined>(undefined);

  readonly groupFileInput = viewChild<ElementRef<HTMLInputElement>>('groupFileInput');

  /** Which group the next file-picker selection applies to (single shared input). */
  private pendingGroupUpload = signal<{ groupId: string } | null>(null);
  public groupPhotoUploading = signal(false);

  // For object files: receives FileGroup[]
  public fileGroups = input<FileGroup[]>([]);
  /** When set, only groups matching these category labels are shown (full list kept for reorder API). */
  public categoryFilter = input<string[]>([]);
  // For project files: receives ProjectFile[]
  public projectFiles = input<ProjectFile[]>([]);
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
  }

  /** True if the file is soft-deleted (non-null `deleted_at` timestamp). */
  private hasDeletedAt(file: FileGroupItem | ProjectFile): boolean {
    return parseMongoDateToMs((file as { deleted_at?: unknown }).deleted_at) != null;
  }

  /** True when the whole file group was soft-deleted. */
  private isGroupRemoved(group: FileGroup): boolean {
    return parseMongoDateToMs(group.deleted_at) != null;
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
        : activeGroups.filter((g) =>
            fileGroupCategoryLabels(g).some((l) => filterLabels.includes(l)),
          );

    return groups.map((group) => ({
      ...group,
      files: sortFileGroupItemsByStoredOrder(
        group.files.filter(
          (file) => !this.failedFileIds.has(file._id?.$oid || '') && !this.hasDeletedAt(file),
        ),
      ),
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

  /** Open modal to pick another group; then move this file. */
  public openMoveFileModal(event: Event, file: FileGroupItem, currentGroup: FileGroup): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.moveFileInProgress()) return;

    const targets = this.moveTargetsExcludingGroup(currentGroup);
    if (targets.length === 0) return;

    this.activeFileId.set(null);

    const targetRows = targets
      .map((g) => {
        const oid = g._id?.$oid;
        if (!oid) return null;
        return { groupId: oid, label: this.getGroupDisplayName(g) };
      })
      .filter((r): r is { groupId: string; label: string } => r !== null);

    const { childRef } = this.#modalService.open({
      title: 'fileList.movePickDestination',
      component: MoveFileToGroupModalComponent,
      componentInputs: { targetRows },
      wide: true,
    });

    if (childRef) {
      const inst = childRef.instance as MoveFileToGroupModalComponent;
      const sub = inst.groupPicked.subscribe((targetGroupId: string) => {
        sub.unsubscribe();
        this.#moveFileToGroup(file, targetGroupId);
      });
    }
  }

  #moveFileToGroup(file: FileGroupItem, targetGroupId: string): void {
    const fileId = file._id?.$oid;
    if (!fileId || this.moveFileInProgress()) return;

    this.moveFileInProgress.set(true);
    this.#fileService
      .moveFileToGroup(fileId, targetGroupId)
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
      .uploadFileForObject(form, objectId, { groupId })
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
    const d = new Date(ms);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}.${month}.${year}`;
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
    if (this.imageLightboxUrl()) {
      this.closeImageLightbox();
    }
  }

  ngOnDestroy(): void {
    this.#restoreBodyScroll();
  }

  #lockBodyScroll(): void {
    document.body.style.overflow = 'hidden';
  }

  #restoreBodyScroll(): void {
    document.body.style.removeProperty('overflow');
  }

  public openImageLightbox(event: Event, file: FileGroupItem | ProjectFile): void {
    event.stopPropagation();
    event.preventDefault();
    this.imageLightboxUrl.set(this.getImageUrl(file.path));
    this.imageLightboxAlt.set(file.filename || '');
    this.activeFileId.set(null);
    this.#lockBodyScroll();
  }

  public closeImageLightbox(): void {
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
