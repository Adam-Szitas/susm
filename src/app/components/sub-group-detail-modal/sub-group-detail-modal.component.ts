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
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import {
  FileGroup,
  FileGroupItem,
  FileSubGroup,
  fileSubGroupCategoryLabels,
  mergeVisibleReorderIntoFullOrder,
  parseMongoDateToMs,
  sortFileGroupItemsByStoredOrder,
} from '@models';
import { environment } from '../../environment';
import { FileService } from '../../services/file.service';
import { lockDocumentScroll, unlockDocumentScroll } from '../../services/document-scroll-lock';
import { ModalService } from '../../services/modal.service';
import { NotificationService } from '../../services/notification.service';
import { TranslationService } from '../../services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TrashIconComponent } from '../shared/trash-icon.component';
import { compactFormActions } from '../shared/compact-form-actions';
import {
  MoveFileTargetRow,
  MoveFileToGroupModalComponent,
} from '../file-list/move-file-to-group-modal.component';

@Component({
  selector: 'app-sub-group-detail-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, IconComponent, TrashIconComponent],
  templateUrl: './sub-group-detail-modal.component.html',
  styleUrl: './sub-group-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubGroupDetailModalComponent implements OnDestroy {
  protected readonly icons = icons;
  readonly iconOnlyActions = compactFormActions();

  #fileService = inject(FileService);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  readonly imageLightbox = viewChild<ElementRef<HTMLDialogElement>>('imageLightbox');

  isOpen = input<boolean>(false);
  subGroup = input<FileSubGroup | null>(null);
  parentGroup = input<FileGroup | null>(null);
  /** All groups on the object (for move targets). */
  allGroups = input<FileGroup[]>([]);
  projectCategories = input<string[]>([]);

  closed = output<void>();
  metadataUpdated = output<void>();
  requestAddPhotos = output<void>();

  editingMetadata = signal(false);
  editName = signal('');
  editCategories = signal<string[]>([]);
  categoryCustomDraft = signal('');
  editNote = signal('');
  savingMetadata = signal(false);

  activeFileId = signal<string | null>(null);
  imageLightboxUrl = signal<string | null>(null);
  imageLightboxAlt = signal('');
  moveFileInProgress = signal(false);
  reorderMode = signal(false);
  reorderSaving = signal(false);
  draggedFileId = signal<string | null>(null);
  dragOverFileId = signal<string | null>(null);
  deleteConfirmOpen = signal(false);
  deletingSubGroup = signal(false);
  savingFileNoteId = signal<string | null>(null);
  private fileNoteDrafts = signal<Record<string, string>>({});
  private wasOpen = false;
  private failedFileIds = new Set<string>();

  readonly visibleFiles = computed(() => {
    const sg = this.subGroup();
    if (!sg) return [];
    return sortFileGroupItemsByStoredOrder(
      sg.files.filter(
        (f) => !this.failedFileIds.has(f._id?.$oid || '') && parseMongoDateToMs(f.deleted_at as unknown) == null,
      ),
    );
  });

  readonly categoryOptionsForEdit = computed(() => {
    const merged = new Set<string>();
    for (const c of this.projectCategories()) {
      const t = c?.trim();
      if (t) merged.add(t);
    }
    const sg = this.subGroup();
    if (sg) {
      for (const c of fileSubGroupCategoryLabels(sg)) {
        merged.add(c);
      }
    }
    for (const c of this.editCategories()) {
      merged.add(c);
    }
    return Array.from(merged).sort();
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.isOpen()) {
        return;
      }
      lockDocumentScroll();
      onCleanup(() => unlockDocumentScroll());
    });

    effect(() => {
      const open = this.isOpen();
      if (!open) {
        this.resetState();
        this.wasOpen = false;
        return;
      }
      // Clear drafts only on open transition — not on every effect re-run while open.
      if (!this.wasOpen) {
        this.fileNoteDrafts.set({});
        this.wasOpen = true;
      }
    });

    effect(() => {
      const sg = this.subGroup();
      if (!sg) return;
      this.fileNoteDrafts.update((drafts) => {
        if (!Object.keys(drafts).length) return drafts;
        const next = { ...drafts };
        let changed = false;
        for (const file of sg.files) {
          const id = file._id?.$oid;
          if (!id || !Object.prototype.hasOwnProperty.call(next, id)) continue;
          const persisted = file.note?.trim() ?? '';
          if (next[id].trim() === persisted) {
            delete next[id];
            changed = true;
          }
        }
        return changed ? next : drafts;
      });
    });
  }

  ngOnDestroy(): void {
    unlockDocumentScroll();
  }

  subGroupCategoryLabels = fileSubGroupCategoryLabels;

  onClose(): void {
    this.flushDirtyFileNotes();
    this.closed.emit();
  }

  startEditMetadata(): void {
    const sg = this.subGroup();
    if (!sg) return;
    this.editingMetadata.set(true);
    this.editName.set(sg.name ?? '');
    this.editCategories.set([...fileSubGroupCategoryLabels(sg)]);
    this.categoryCustomDraft.set('');
    this.editNote.set(sg.note ?? '');
  }

  cancelEditMetadata(): void {
    this.editingMetadata.set(false);
  }

  isEditCategorySelected(label: string): boolean {
    return this.editCategories().includes(label);
  }

  toggleEditCategory(label: string): void {
    const t = label.trim();
    if (!t) return;
    this.editCategories.update((list) =>
      list.includes(t) ? list.filter((c) => c !== t) : [...list, t],
    );
  }

  addCustomCategoryFromDraft(): void {
    const t = this.categoryCustomDraft().trim();
    if (!t) return;
    this.editCategories.update((list) => (list.includes(t) ? list : [...list, t]));
    this.categoryCustomDraft.set('');
  }

  removeEditCategory(label: string): void {
    this.editCategories.update((list) => list.filter((c) => c !== label));
  }

  saveMetadata(): void {
    const sg = this.subGroup();
    const id = sg?._id?.$oid;
    if (!id || this.savingMetadata()) return;

    const name = this.editName().trim();
    if (!name) {
      this.#notificationService.showError(
        this.#translationService.instant('subGroups.nameRequired'),
      );
      return;
    }

    const categories = [...new Set(this.editCategories().map((c) => c.trim()).filter(Boolean))];
    const noteRaw = this.editNote().trim();
    const note = noteRaw === '' ? null : noteRaw;

    this.savingMetadata.set(true);
    this.#fileService
      .updateSubGroup(id, { name, categories, note })
      .pipe(finalize(() => this.savingMetadata.set(false)))
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('subGroups.updateSuccess'),
          );
          this.editingMetadata.set(false);
          this.metadataUpdated.emit();
        },
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('subGroups.updateFailed'),
          );
        },
      });
  }

  openDeleteConfirm(): void {
    this.deleteConfirmOpen.set(true);
  }

  cancelDeleteConfirm(): void {
    this.deleteConfirmOpen.set(false);
  }

  confirmDeleteSubGroup(mode: 'delete_all' | 'unwrap'): void {
    const id = this.subGroup()?._id?.$oid;
    if (!id || this.deletingSubGroup()) return;

    this.deletingSubGroup.set(true);
    this.#fileService
      .deleteSubGroup(id, mode)
      .pipe(finalize(() => this.deletingSubGroup.set(false)))
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant(
              mode === 'delete_all' ? 'subGroups.deleteAllSuccess' : 'subGroups.unwrapSuccess',
            ),
          );
          this.deleteConfirmOpen.set(false);
          this.metadataUpdated.emit();
          this.onClose();
        },
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('subGroups.deleteFailed'),
          );
        },
      });
  }

  getImageUrl(path: string): string {
    let normalizedPath = path.replace(/^[.\\/]+/, '').replace(/\\/g, '/');
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      return `${environment.be}${environment.folderBase}/${encodeURIComponent(normalizedPath)}`;
    }
    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring('uploads/'.length);
    }
    const pathSegments = normalizedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment));
    return `${environment.be}${environment.folderBase}/${pathSegments.join('/')}`;
  }

  onImageContainerClick(event: MouseEvent, file: FileGroupItem): void {
    if (this.reorderMode()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const id = file._id?.$oid;
    if (!id) return;

    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }

    event.stopPropagation();
    this.activeFileId.set(this.activeFileId() === id ? null : id);
  }

  hideOverlay(): void {
    this.activeFileId.set(null);
  }

  openImageLightbox(event: Event, file: FileGroupItem): void {
    event.stopPropagation();
    event.preventDefault();
    this.imageLightboxUrl.set(this.getImageUrl(file.path));
    this.imageLightboxAlt.set(file.filename || '');
    this.activeFileId.set(null);
    const dialog = this.imageLightbox()?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    lockDocumentScroll();
  }

  closeImageLightbox(): void {
    const dialog = this.imageLightbox()?.nativeElement;
    if (dialog?.open) {
      dialog.close();
      return;
    }
    this.imageLightboxUrl.set(null);
    this.imageLightboxAlt.set('');
    unlockDocumentScroll();
  }

  onImageLightboxDialogClose(): void {
    this.imageLightboxUrl.set(null);
    this.imageLightboxAlt.set('');
    unlockDocumentScroll();
  }

  onImageLightboxBackdropClick(event: MouseEvent): void {
    const dialog = event.currentTarget as HTMLDialogElement;
    if (event.target === dialog) {
      dialog.close();
    }
  }

  handleOverlayDownload(event: Event, path: string, filename?: string): void {
    event.stopPropagation();
    event.preventDefault();
    this.downloadFile(path, filename);
  }

  handleOverlayDelete(event: Event, file: FileGroupItem): void {
    event.stopPropagation();
    event.preventDefault();
    this.deleteFile(file);
  }

  fileNoteDraft(file: FileGroupItem): string {
    const id = file._id?.$oid;
    if (!id) return '';
    const drafts = this.fileNoteDrafts();
    if (Object.prototype.hasOwnProperty.call(drafts, id)) {
      return drafts[id];
    }
    return file.note?.trim() ?? '';
  }

  onFileNoteInput(file: FileGroupItem, value: string): void {
    const id = file._id?.$oid;
    if (!id) return;
    this.fileNoteDrafts.update((drafts) => ({ ...drafts, [id]: value }));
  }

  isFileNoteDirty(file: FileGroupItem): boolean {
    const id = file._id?.$oid;
    if (!id) return false;
    return this.fileNoteDraft(file).trim() !== (file.note?.trim() ?? '');
  }

  saveFileNote(file: FileGroupItem, options?: { silent?: boolean }): void {
    const id = file._id?.$oid;
    if (!id || this.savingFileNoteId() === id) return;
    const draft = this.fileNoteDraft(file).trim();
    const current = file.note?.trim() ?? '';
    if (draft === current) return;

    this.savingFileNoteId.set(id);
    this.#fileService
      .updateFileMetadata(id, { note: draft })
      .pipe(finalize(() => this.savingFileNoteId.set(null)))
      .subscribe({
        next: () => {
          // Keep draft until parent reload confirms the same persisted value.
          this.fileNoteDrafts.update((drafts) => ({ ...drafts, [id]: draft }));
          if (!options?.silent) {
            this.#notificationService.showSuccess(
              this.#translationService.instant('fileList.updateMetadataSuccess'),
            );
          }
          this.metadataUpdated.emit();
        },
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('subGroups.updateFailed'),
          );
        },
      });
  }

  /** Persist dirty notes when leaving a field (mobile soft-keyboard dismiss). */
  onFileNoteBlur(file: FileGroupItem): void {
    if (!this.isFileNoteDirty(file) || this.isSavingFileNote(file) || this.reorderMode()) {
      return;
    }
    this.saveFileNote(file, { silent: true });
  }

  /** Fire-and-forget save for any dirty notes when closing the modal. */
  private flushDirtyFileNotes(): void {
    const sg = this.subGroup();
    if (!sg) return;
    for (const file of sg.files) {
      if (this.isFileNoteDirty(file)) {
        this.saveFileNote(file, { silent: true });
      }
    }
  }

  isSavingFileNote(file: FileGroupItem): boolean {
    const id = file._id?.$oid;
    return !!id && this.savingFileNoteId() === id;
  }

  downloadFile(path: string, filename?: string): void {
    const url = this.getImageUrl(path);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.download = filename || path.split(/[\\/]/).pop() || 'file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async deleteFile(file: FileGroupItem): Promise<void> {
    const fileId = file._id?.$oid;
    if (!fileId) return;

    const fileName = file.filename || file.path?.split(/[\\/]/).pop() || 'file';
    const confirmed = await this.#modalService.openConfirm({
      title: 'fileList.deleteFile',
      message: this.#translationService.instant('fileList.confirmDelete', { fileName }),
      confirmText: 'common.delete',
      cancelText: 'common.cancel',
      confirmKind: 'danger',
    });
    if (!confirmed) return;

    this.failedFileIds.add(fileId);
    this.#fileService.deleteFile(fileId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('fileList.deleteSuccess'),
        );
        this.metadataUpdated.emit();
      },
      error: (error: Error) => {
        this.failedFileIds.delete(fileId);
        this.#notificationService.showError(
          error.message || this.#translationService.instant('fileList.deleteFailed'),
        );
      },
    });
  }

  onImageError(file: FileGroupItem, event: Event): void {
    const fileId = file._id?.$oid;
    if (fileId) {
      this.failedFileIds.add(fileId);
      const img = event.target as HTMLImageElement;
      if (img) img.style.display = 'none';
    }
  }

  buildMoveTargets(): MoveFileTargetRow[] {
    const parent = this.parentGroup();
    const sg = this.subGroup();
    const currentGroupId = parent?._id?.$oid;
    const sourceSubGroupId = sg?._id?.$oid;
    if (!currentGroupId || !sourceSubGroupId) return [];

    const rows: MoveFileTargetRow[] = [];

    for (const g of this.allGroups()) {
      const groupId = g._id?.$oid;
      if (!groupId) continue;

      const activeSubGroups = (g.sub_groups ?? [])
        .filter((s) => parseMongoDateToMs(s.deleted_at as unknown) == null)
        .map((s) => {
          const sid = s._id?.$oid;
          if (!sid) return null;
          if (groupId === currentGroupId && sid === sourceSubGroupId) return null;
          return {
            subGroupId: sid,
            label: s.name?.trim() || sid.slice(-6),
          };
        })
        .filter((s): s is { subGroupId: string; label: string } => s !== null);

      const isCurrentGroup = groupId === currentGroupId;
      const groupLabel = g.description?.trim() || groupId.slice(-6);

      if (isCurrentGroup) {
        rows.push({
          groupId,
          label: `${groupLabel} (${this.#translationService.instant('subGroups.groupRoot')})`,
          includeGroupRoot: true,
        });
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

  openMoveFileModal(event: Event, file: FileGroupItem): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.moveFileInProgress()) return;

    const targets = this.buildMoveTargets();
    if (targets.length === 0) return;

    this.activeFileId.set(null);

    const { childRef } = this.#modalService.open({
      title: 'fileList.movePickDestination',
      component: MoveFileToGroupModalComponent,
      componentInputs: { targetRows: targets },
      wide: true,
    });

    if (childRef) {
      const inst = childRef.instance as MoveFileToGroupModalComponent;
      const sub = inst.destinationPicked.subscribe(({ groupId, subGroupId }) => {
        sub.unsubscribe();
        this.#moveFile(file, groupId, subGroupId);
      });
    }
  }

  #moveFile(file: FileGroupItem, targetGroupId: string, targetSubGroupId?: string): void {
    const fileId = file._id?.$oid;
    if (!fileId || this.moveFileInProgress()) return;

    this.moveFileInProgress.set(true);
    this.#fileService
      .moveFileToGroup(fileId, targetGroupId, targetSubGroupId ?? null)
      .pipe(finalize(() => this.moveFileInProgress.set(false)))
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('fileList.moveSuccess', { count: 1 }),
          );
          this.metadataUpdated.emit();
        },
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('fileList.moveFailed'),
          );
        },
      });
  }

  toggleReorderMode(): void {
    const turningOn = !this.reorderMode();
    this.reorderMode.update((v) => !v);
    if (turningOn) {
      this.hideOverlay();
    } else {
      this.draggedFileId.set(null);
      this.dragOverFileId.set(null);
    }
  }

  #visibleFileOrderIds(): string[] {
    return this.visibleFiles()
      .map((f) => f._id?.$oid)
      .filter((id): id is string => !!id);
  }

  #activeFilesForReorder(): FileGroupItem[] {
    const sg = this.subGroup();
    if (!sg) return [];
    return sortFileGroupItemsByStoredOrder(
      sg.files.filter((f) => parseMongoDateToMs(f.deleted_at as unknown) == null),
    );
  }

  #fileOrderIdsForSubGroup(): string[] {
    return this.#activeFilesForReorder()
      .map((f) => f._id?.$oid)
      .filter((id): id is string => !!id);
  }

  #saveVisibleReorder(visibleOrderAfter: string[]): void {
    const sg = this.subGroup();
    const subGroupId = sg?._id?.$oid;
    if (!subGroupId) return;

    const fullBefore = this.#fileOrderIdsForSubGroup();
    const visibleBefore = this.#visibleFileOrderIds();
    if (!fullBefore.length || !visibleBefore.length) return;

    const merged = mergeVisibleReorderIntoFullOrder(fullBefore, visibleBefore, visibleOrderAfter);
    this.#saveFileOrder(subGroupId, merged);
  }

  onDragStart(event: DragEvent, file: FileGroupItem): void {
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

  onDragOver(event: DragEvent, file: FileGroupItem): void {
    event.preventDefault();
    const id = file._id?.$oid;
    if (id && id !== this.draggedFileId()) {
      this.dragOverFileId.set(id);
    }
  }

  onDragLeave(_event: DragEvent, file: FileGroupItem): void {
    const id = file._id?.$oid;
    if (id && this.dragOverFileId() === id) {
      this.dragOverFileId.set(null);
    }
  }

  onDrop(event: DragEvent, targetFile: FileGroupItem): void {
    event.preventDefault();
    if (this.reorderSaving()) return;

    const draggedId = this.draggedFileId();
    const targetId = targetFile._id?.$oid;
    if (!draggedId || !targetId || draggedId === targetId) {
      this.draggedFileId.set(null);
      this.dragOverFileId.set(null);
      return;
    }

    const visibleBefore = this.#visibleFileOrderIds();
    const fromIndex = visibleBefore.indexOf(draggedId);
    const toIndex = visibleBefore.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const visibleAfter = [...visibleBefore];
    visibleAfter.splice(fromIndex, 1);
    visibleAfter.splice(toIndex, 0, draggedId);

    this.draggedFileId.set(null);
    this.dragOverFileId.set(null);
    this.#saveVisibleReorder(visibleAfter);
  }

  onDragEnd(): void {
    this.draggedFileId.set(null);
    this.dragOverFileId.set(null);
  }

  moveFileUp(file: FileGroupItem): void {
    if (this.reorderSaving()) return;
    const visible = [...this.#visibleFileOrderIds()];
    const index = visible.indexOf(file._id.$oid);
    if (index <= 0) return;
    [visible[index - 1], visible[index]] = [visible[index], visible[index - 1]];
    this.#saveVisibleReorder(visible);
  }

  moveFileDown(file: FileGroupItem): void {
    if (this.reorderSaving()) return;
    const visible = [...this.#visibleFileOrderIds()];
    const index = visible.indexOf(file._id.$oid);
    if (index === -1 || index >= visible.length - 1) return;
    [visible[index], visible[index + 1]] = [visible[index + 1], visible[index]];
    this.#saveVisibleReorder(visible);
  }

  #saveFileOrder(subGroupId: string, fileIds: string[]): void {
    if (this.reorderSaving()) return;
    this.reorderSaving.set(true);
    this.#fileService
      .reorderSubGroupFiles(subGroupId, fileIds)
      .pipe(finalize(() => this.reorderSaving.set(false)))
      .subscribe({
        next: () => this.metadataUpdated.emit(),
        error: (error: Error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('subGroups.reorderFilesFailed'),
          );
        },
      });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.deleteConfirmOpen()) {
      this.cancelDeleteConfirm();
      return;
    }
    if (this.imageLightboxUrl()) {
      this.closeImageLightbox();
      return;
    }
    if (this.isOpen()) {
      this.onClose();
    }
  }

  private resetState(): void {
    this.editingMetadata.set(false);
    this.activeFileId.set(null);
    this.reorderMode.set(false);
    this.deleteConfirmOpen.set(false);
    this.imageLightboxUrl.set(null);
    this.fileNoteDrafts.set({});
    this.savingFileNoteId.set(null);
  }
}
