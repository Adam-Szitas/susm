import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ImageCompressionService } from '@services/image-compression.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';

interface FilePreview {
  file: globalThis.File;
  previewUrl: string;
}

@Component({
  selector: 'app-file-upload-modal',
  standalone: true,
  imports: [TranslateModule, FormsModule],
  templateUrl: './file-upload-modal.component.html',
  styleUrl: './file-upload-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadModalComponent {
  #imageCompressionService = inject(ImageCompressionService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  isOpen = input<boolean>(false);
  files = input<globalThis.File[]>([]);
  categories = input<string[]>([]);
  uploading = input<boolean>(false);

  filesSelected = output<globalThis.File[]>();
  upload = output<{ files: globalThis.File[]; description: string; category: string }>();
  cancel = output<void>();

  description = signal('');
  category = signal('');
  filePreviews = signal<FilePreview[]>([]);
  compressing = signal(false);

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      input.value = '';
      return;
    }

    const files = Array.from(input.files);
    const imageFiles = files.filter(file => this.#imageCompressionService.isImageFile(file));

    if (imageFiles.length === 0) {
      input.value = '';
      return;
    }

    // Get existing files to avoid duplicates
    const existingFiles = this.filePreviews().map(p => p.file);
    const existingFileKeys = new Set(
      existingFiles.map(f => `${f.name}-${f.size}-${f.lastModified}`)
    );

    // Filter out files that are already selected
    const newFiles = imageFiles.filter(
      file => !existingFileKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
    );

    if (newFiles.length === 0) {
      // Reset input to allow selecting the same file again if needed
      input.value = '';
      return;
    }

    // Compress images and create previews
    this.compressing.set(true);
    try {
      const compressedFiles = await this.#imageCompressionService.compressImages(newFiles);

      // Create previews for compressed files - fix race condition by using Promise.all
      const currentPreviews = [...this.filePreviews()];
      const previewPromises = compressedFiles.map((file) => {
        return new Promise<FilePreview>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
          reader.onload = (e: ProgressEvent<FileReader>) => {
            resolve({
              file,
              previewUrl: e.target?.result as string,
            });
          };
          reader.readAsDataURL(file);
        });
      });

      const newPreviews = await Promise.all(previewPromises);
      const allPreviews = [...currentPreviews, ...newPreviews];
      this.filePreviews.set(allPreviews);
      this.filesSelected.emit(allPreviews.map(p => p.file));
    } catch (error) {
      console.error('Error processing files:', error);
      this.#notificationService.showError(
        error instanceof Error
          ? error.message
          : this.#translationService.instant('errors.imageCompressionFailed'),
      );
      input.value = '';
    } finally {
      this.compressing.set(false);
      // Reset input to allow selecting more files
      input.value = '';
    }
  }

  onUpload(): void {
    const files = this.filePreviews().map(p => p.file);
    if (files.length === 0) return;

    this.upload.emit({
      files,
      description: this.description().trim(),
      category: this.category().trim(),
    });
  }

  onCancel(): void {
    this.description.set('');
    this.category.set('');
    this.filePreviews.set([]);
    this.compressing.set(false);
    this.cancel.emit();
  }

  removeFile(index: number): void {
    const previews = this.filePreviews();
    previews.splice(index, 1);
    this.filePreviews.set([...previews]);
    this.filesSelected.emit(previews.map(p => p.file));
  }

  clearAll(): void {
    this.filePreviews.set([]);
    this.description.set('');
    this.category.set('');
    this.compressing.set(false);
  }
}

