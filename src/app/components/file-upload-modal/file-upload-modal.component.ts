import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ImageCompressionService } from '@services/image-compression.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';

interface FilePreview {
  file: globalThis.File;
  previewUrl: string;
  uniqueId: string; // Unique identifier for each file to prevent duplicates
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

    // Get existing unique IDs to avoid duplicates
    const existingUniqueIds = new Set(
      this.filePreviews().map(p => p.uniqueId)
    );

    // Create unique identifiers for new files
    // For camera photos, we need to ensure each file gets a unique ID even if they have the same name/size
    const newFilesWithIds = imageFiles.map((file, index) => ({
      file,
      uniqueId: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 15)}-${file.name}-${file.size}`
    }));

    // Filter out files that might be duplicates (though camera photos should all be unique)
    const filesToProcess = newFilesWithIds.filter(
      ({ uniqueId }) => !existingUniqueIds.has(uniqueId)
    );

    if (filesToProcess.length === 0) {
      // Reset input to allow selecting the same file again if needed
      input.value = '';
      return;
    }

    // Compress images and create previews
    this.compressing.set(true);
    try {
      // Compress all files
      const filesToCompress = filesToProcess.map(({ file }) => file);
      const compressedFiles = await this.#imageCompressionService.compressImages(filesToCompress);

      // Create previews for compressed files with unique IDs
      // CRITICAL FIX: Ensure each compressed file gets its own unique File object
      // This prevents the issue where multiple camera photos end up referencing the same file
      const currentPreviews = [...this.filePreviews()];
      const previewPromises = compressedFiles.map((compressedFile, index) => {
        return new Promise<FilePreview>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error(`Failed to read file: ${compressedFile.name}`));
          reader.onload = (e: ProgressEvent<FileReader>) => {
            // Create a new File object with a unique name and timestamp to ensure it's treated as a separate file
            // This is critical for camera photos which might have the same original filename
            const uniqueFileName = `${Date.now()}-${index}-${compressedFile.name}`;
            const uniqueFile = new File([compressedFile], uniqueFileName, {
              type: compressedFile.type,
              lastModified: Date.now() + index, // Ensure unique timestamp for each file
            });
            
            resolve({
              file: uniqueFile,
              previewUrl: e.target?.result as string,
              uniqueId: filesToProcess[index].uniqueId, // Use the original unique ID
            });
          };
          reader.readAsDataURL(compressedFile);
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
    const updatedPreviews = previews.filter((_, i) => i !== index);
    this.filePreviews.set(updatedPreviews);
    this.filesSelected.emit(updatedPreviews.map(p => p.file));
  }

  clearAll(): void {
    this.filePreviews.set([]);
    this.description.set('');
    this.category.set('');
    this.compressing.set(false);
  }
}

