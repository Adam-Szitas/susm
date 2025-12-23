import {
  ChangeDetectionStrategy,
  Component,
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
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  // For object files: receives FileGroup[]
  public fileGroups = input<FileGroup[]>([]);
  // For project files: receives ProjectFile[]
  public projectFiles = input<ProjectFile[]>([]);
  
  public activeFileId: string | null = null;
  public fileDeleted = output<void>();
  public metadataUpdated = output<void>();

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
    this.editFileCreatedAt.set(file.created_at || '');
  }

  public cancelEditFile(): void {
    this.editingFileId.set(null);
  }

  public saveFileMetadata(file: FileGroupItem | ProjectFile): void {
    const id = file._id?.$oid;
    if (!id) return;

    const description = this.editFileDescription().trim();
    const filename = this.editFileName().trim();
    const createdAt = this.editFileCreatedAt().trim();

    this.#fileService
      .updateFileMetadata(id, {
        description: description || undefined,
        filename: filename || undefined,
        created_at: createdAt || undefined,
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
    this.activeFileId = id;
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

  public deleteFile(file: FileGroupItem | ProjectFile): void {
    const fileId = file._id?.$oid;
    if (!fileId) {
      this.#notificationService.showError(
        this.#translationService.instant('fileList.deleteFailed') || 'Invalid file ID',
      );
      return;
    }

    const fileName = file.filename || file.path.split(/[\\/]/).pop() || 'file';
    let confirmMessage = this.#translationService.instant('fileList.confirmDelete', { fileName });
    if (confirmMessage === 'fileList.confirmDelete') {
      confirmMessage = `Are you sure you want to delete "${fileName}"?`;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    this.#fileService.deleteFile(fileId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('fileList.deleteSuccess') || 'File deleted successfully',
        );
        this.fileDeleted.emit();
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message ||
            this.#translationService.instant('fileList.deleteFailed') ||
            'Failed to delete file',
        );
      },
    });
  }
}
