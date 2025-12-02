import { ChangeDetectionStrategy, Component, inject, input, output, computed } from '@angular/core';
import { File } from '@models';
import { environment } from '../../environment';
import { TranslateModule } from '@ngx-translate/core';
import { FileService } from '../../services/file.service';
import { NotificationService } from '../../services/notification.service';
import { TranslationService } from '../../services/translation.service';

interface FileGroup {
  groupId: string;
  description: string | null;
  category: string | null;
  files: File[];
  createdAt: string; // Use the earliest file's created_at for sorting
}

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.component.html',
  styleUrl: './file-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslateModule],
})
export class FileListComponent {
  #fileService = inject(FileService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  public files = input<File[]>([]);
  // Used on mobile to control when the overlay actions are visible/clickable
  public activeFileId: string | null = null;
  public fileDeleted = output<void>();

  // Group files by group_id
  public fileGroups = computed(() => {
    const allFiles = this.files();
    const groupsMap = new Map<string, FileGroup>();
    const ungroupedFiles: File[] = [];

    allFiles.forEach((file) => {
      const groupId = file.group_id?.$oid;
      
      if (groupId) {
        if (!groupsMap.has(groupId)) {
          // Create new group with first file's metadata
          groupsMap.set(groupId, {
            groupId,
            description: file.description || null,
            category: file.category || null,
            files: [file],
            createdAt: file.created_at,
          });
        } else {
          // Add file to existing group
          const group = groupsMap.get(groupId)!;
          group.files.push(file);
          // Update createdAt to earliest file
          if (file.created_at < group.createdAt) {
            group.createdAt = file.created_at;
          }
        }
      } else {
        // File has no group_id - add to ungrouped
        ungroupedFiles.push(file);
      }
    });

    // Convert map to array and sort by creation date (newest first)
    const groups = Array.from(groupsMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Sort ungrouped files by creation date (newest first)
    ungroupedFiles.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { groups, ungroupedFiles };
  });

  public getImageUrl(path: string): string {
    let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');

    // If it's already a full URL (R2 URL), encode it and send through backend proxy
    // This ensures the backend can fetch from R2 even if the bucket is private
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      // URL-encode the entire R2 URL so it can be sent through /uploads/ endpoint
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

  public showOverlay(file: File): void {
    const id = file._id?.$oid;
    if (!id) return;
    this.activeFileId = id;
  }

  public downloadFile(path: string): void {
    let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');

    // If it's already a full URL (R2 URL), encode it and send through backend proxy
    let url: string;
    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      // URL-encode the entire R2 URL so it can be sent through /uploads/ endpoint
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
    const filename = path.split(/[\\/]/).pop() || 'file';
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  public deleteFile(file: File): void {
    const fileId = file._id?.$oid;
    if (!fileId) {
      this.#notificationService.showError(
        this.#translationService.instant('fileList.deleteFailed') || 'Invalid file ID',
      );
      return;
    }

    const fileName = file.filename || file.path.split(/[\\/]/).pop() || 'file';
    let confirmMessage = this.#translationService.instant('fileList.confirmDelete', { fileName });
    // Fallback if translation returns the key (translation not found)
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
        // Emit event to parent component to refresh the file list
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
