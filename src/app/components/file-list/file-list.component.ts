import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { File } from "@models";
import { environment } from "../../environment";
import { TranslateModule } from "@ngx-translate/core";
import { FileService } from "../../services/file.service";
import { NotificationService } from "../../services/notification.service";
import { TranslationService } from "../../services/translation.service";

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
    public fileDeleted = output<void>();

    public getImageUrl(path: string): string {
        let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');
        
        if (normalizedPath.startsWith('uploads/')) {
            normalizedPath = normalizedPath.substring('uploads/'.length);
        }

        const pathSegments = normalizedPath.split('/').map(segment => encodeURIComponent(segment));
        const encodedPath = pathSegments.join('/');
        return `${environment.be}${environment.folderBase}/${encodedPath}`;
    }

    public downloadFile(path: string): void {
        let normalizedPath = path.replace(/^\.?\/*/, '').replace(/\\/g, '/');
        
        if (normalizedPath.startsWith('uploads/')) {
            normalizedPath = normalizedPath.substring('uploads/'.length);
        }

        const pathSegments = normalizedPath.split('/').map(segment => encodeURIComponent(segment));
        const encodedPath = pathSegments.join('/');
        const url = `${environment.be}${environment.folderBase}/${encodedPath}`;

        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.download = normalizedPath.split('/').pop() || 'file';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    public deleteFile(file: File): void {
        const fileId = file._id?.$oid;
        if (!fileId) {
            this.#notificationService.showError(
                this.#translationService.instant('fileList.deleteFailed') || 'Invalid file ID'
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
                    this.#translationService.instant('fileList.deleteSuccess') || 'File deleted successfully'
                );
                // Emit event to parent component to refresh the file list
                this.fileDeleted.emit();
            },
            error: (error) => {
                this.#notificationService.showError(
                    error.message || 
                    this.#translationService.instant('fileList.deleteFailed') || 
                    'Failed to delete file'
                );
            },
        });
    }
}