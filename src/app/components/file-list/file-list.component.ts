import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileGroup, ProjectFile, FileGroupItem } from '@models';
import { environment } from '../../environment';
import { TranslateModule } from '@ngx-translate/core';
import { FileService } from '../../services/file.service';
import { ModalService } from '../../services/modal.service';
import { NotificationService } from '../../services/notification.service';
import { TranslationService } from '../../services/translation.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
})
export class FileListComponent {
  #fileService = inject(FileService);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  // For object files: receives FileGroup[]
  public fileGroups = input<FileGroup[]>([]);
  // For project files: receives ProjectFile[]
  public projectFiles = input<ProjectFile[]>([]);

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

  // Computed filtered file groups (excluding empty groups and failed files)
  public filteredFileGroups = computed(() => {
    const groups = this.fileGroups();
    return groups
      .map((group) => ({
        ...group,
        files: group.files.filter((file) => !this.failedFileIds.has(file._id?.$oid || '')),
      }))
      .filter((group) => group.files.length > 0);
  });

  // Computed filtered project files (excluding failed files)
  public filteredProjectFiles = computed(() => {
    return this.projectFiles().filter((file) => !this.failedFileIds.has(file._id?.$oid || ''));
  });

  public activeFileId = signal<string | null>(null);
  public fileDeleted = output<void>();
  public metadataUpdated = output<void>();

  // Track files that failed to load
  private failedFileIds = new Set<string>();

  // Inline edit state for group description/category
  public editingGroupId = signal<string | null>(null);
  public editDescription = signal<string>('');
  public editCategory = signal<string>('');

  // Inline edit state for single file description, filename, and created_at
  public editingFileId = signal<string | null>(null);
  public editFileDescription = signal<string>('');
  public editFileName = signal<string>('');
  public editFileCreatedAt = signal<string>('');

  public startEditGroup(group: FileGroup): void {
    const id = group._id?.$oid;
    if (!id) return;
    this.editingGroupId.set(id);
    this.editDescription.set(group.description ?? '');
    this.editCategory.set(group.category ?? '');
  }

  public cancelEditGroup(): void {
    this.editingGroupId.set(null);
  }

  public saveGroupMetadata(group: FileGroup): void {
    const id = group._id?.$oid;
    if (!id) return;

    const description = this.editDescription().trim();
    const categoryRaw = this.editCategory().trim();
    const category = categoryRaw === '' ? null : categoryRaw;

    this.#fileService
      .updateFileGroup(id, {
        description: description || undefined,
        category,
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

    // Format created_at for date input (YYYY-MM-DD format)
    let dateValue = '';
    if (file.created_at) {
      const raw: any = (file as any).created_at;
      let date: Date | null = null;

      if (raw instanceof Date) {
        date = raw;
      } else if (typeof raw === 'string') {
        date = new Date(raw);
        if (isNaN(date.getTime())) {
          date = null;
        }
      } else if (typeof raw === 'object' && raw !== null) {
        // Handle BSON-style objects
        const candidate = (raw as any).$date ?? (raw as any).date ?? null;
        if (candidate) {
          const timestamp =
            typeof candidate === 'number'
              ? candidate
              : candidate.$numberLong
                ? Number(candidate.$numberLong)
                : null;
          if (timestamp) {
            date = new Date(timestamp);
          }
        }
      }

      if (date && !isNaN(date.getTime())) {
        // Format as YYYY-MM-DD for date input
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
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

    this.#fileService
      .updateFileMetadata(id, {
        description: description || undefined,
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
   * Safely formats created_at for display, handling various backend shapes.
   */
  public getCreatedAtDisplay(file: FileGroupItem | ProjectFile): string | null {
    const raw: any = (file as any).created_at;
    if (!raw) return null;

    let date: Date | null = null;

    if (raw instanceof Date) {
      date = raw;
    } else if (typeof raw === 'string' || typeof raw === 'number') {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) {
        date = d;
      }
    } else if (typeof raw === 'object') {
      // Handle possible BSON-style or custom objects, e.g. { $date: ... } or { $numberLong: "..." }
      const candidate = (raw as any).$date ?? (raw as any).date ?? null;
      if (candidate) {
        if (typeof candidate === 'string' || typeof candidate === 'number') {
          const d = new Date(candidate);
          if (!Number.isNaN(d.getTime())) {
            date = d;
          }
        } else if (candidate.$numberLong != null) {
          const d = new Date(Number(candidate.$numberLong));
          if (!Number.isNaN(d.getTime())) {
            date = d;
          }
        }
      }
    }

    if (!date) return null;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  public getImageUrl(path: string): string {
    let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');

    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      const encodedPath = encodeURIComponent(normalizedPath);
      return `${environment.be}${environment.folderBase}/${encodedPath}`;
    }

    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring('uploads/'.length);
    }

    const pathSegments = normalizedPath.split('/').map((segment) => encodeURIComponent(segment));
    const encodedPath = pathSegments.join('/');
    return `${environment.be}${environment.folderBase}/${encodedPath}`;
  }

  public showOverlay(file: FileGroupItem | ProjectFile): void {
    const id = file._id?.$oid;
    if (!id) return;
    // Toggle: if this overlay is already open, close it; otherwise open it
    this.activeFileId.update((current) => (current === id ? null : id));
  }

  public hideOverlay(): void {
    this.activeFileId.set(null);
  }

  public handleOverlayDownload(event: Event, path: string, filename?: string): void {
    event.stopPropagation();
    event.preventDefault();
    this.downloadFile(path, filename);
  }

  public handleOverlayDelete(event: Event, file: FileGroupItem | ProjectFile): void {
    event.stopPropagation();
    event.preventDefault();
    this.#notificationService.showInfo(`Deleting file: ${file.path}`);
    this.deleteFile(file);
  }

  public downloadFile(path: string, filename?: string): void {
    let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');

    let url: string;
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      const encodedPath = encodeURIComponent(normalizedPath);
      url = `${environment.be}${environment.folderBase}/${encodedPath}`;
    } else {
      if (normalizedPath.startsWith('uploads/')) {
        normalizedPath = normalizedPath.substring('uploads/'.length);
      }

      const pathSegments = normalizedPath.split('/').map((segment) => encodeURIComponent(segment));
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

    this.#notificationService.showInfo(`Handling deletion here: :376`);
    const confirmed = await this.#modalService.openConfirm({
      title,
      message: confirmMessage,
      confirmText: 'common.delete',
      cancelText: 'common.cancel',
      confirmKind: 'danger',
    });
    if (!confirmed) {
      return;
    }

    // Mark as failed immediately to hide it from UI
    this.failedFileIds.add(fileId);

    this.#notificationService.showInfo('Deletion is triggered here: :391');
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
}
