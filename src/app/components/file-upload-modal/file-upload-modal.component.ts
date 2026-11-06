import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ImageCompressionService } from '@services/image-compression.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TrashIconComponent } from '../shared/trash-icon.component';
import { lockDocumentScroll, unlockDocumentScroll } from '@services/document-scroll-lock';
import { CategoryCheckboxListComponent } from '../shared/category-checkbox-list.component';

interface FilePreview {
  file: globalThis.File;
  previewUrl: string;
  uniqueId: string; // Unique identifier for each file to prevent duplicates
}

@Component({
  selector: 'app-file-upload-modal',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    TrashIconComponent,
    IconComponent,
    CategoryCheckboxListComponent,
  ],
  templateUrl: './file-upload-modal.component.html',
  styleUrl: './file-upload-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadModalComponent {
  protected readonly icons = icons;

  #imageCompressionService = inject(ImageCompressionService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  constructor() {
    effect((onCleanup) => {
      if (!this.isOpen()) {
        this.selectionVersion++;
        this.filePreviews.set([]);
        return;
      }
      lockDocumentScroll();
      onCleanup(() => unlockDocumentScroll());
    });
  }

  isOpen = input<boolean>(false);
  files = input<globalThis.File[]>([]);
  categories = input<string[]>([]);
  /** When false, category pickers are hidden (e.g. project-level photo uploads). */
  showCategories = input(true);
  uploading = input<boolean>(false);
  allowGroupingChoice = input(false);
  groupFiles = signal(true);

  filesSelected = output<globalThis.File[]>();
  upload = output<{
    files: globalThis.File[];
    description: string;
    categories: string[];
    note: string;
    groupFiles: boolean;
  }>();
  cancel = output<void>();

  description = signal('');
  /** Selected category labels (multi). */
  selectedCategories = signal<string[]>([]);
  categoryCustomDraft = signal('');
  note = signal('');
  filePreviews = signal<FilePreview[]>([]);
  compressing = signal(false);

  private processingCount = 0;
  private selectionVersion = 0;
  dragging = signal(false);

  onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = this.uploading() ? 'none' : 'copy';
    this.dragging.set(!this.uploading());
  }

  onDragLeave(event: DragEvent): void {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      this.dragging.set(false);
    }
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);
    await this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    await this.addFiles(files);
  }

  async addFiles(files: globalThis.File[]): Promise<void> {
    if (this.uploading() || !this.isOpen()) return;
    const version = this.selectionVersion;
    const imageFiles = files.filter((file) => this.#imageCompressionService.isImageFile(file));

    if (imageFiles.length === 0) {
      return;
    }

    // Get existing unique IDs to avoid duplicates
    const existingUniqueIds = new Set(this.filePreviews().map((p) => p.uniqueId));

    // Create unique identifiers for new files
    // For camera photos, we need to ensure each file gets a unique ID even if they have the same name/size
    const newFilesWithIds = imageFiles.map((file, index) => ({
      file,
      uniqueId: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 15)}-${file.name}-${file.size}`,
    }));

    // Filter out files that might be duplicates (though camera photos should all be unique)
    const filesToProcess = newFilesWithIds.filter(
      ({ uniqueId }) => !existingUniqueIds.has(uniqueId),
    );

    if (filesToProcess.length === 0) {
      return;
    }

    // Compress images and create previews
    this.processingCount++;
    this.compressing.set(true);
    try {
      // Compress all files
      const filesToCompress = filesToProcess.map(({ file }) => file);
      const compressedFiles = await this.#imageCompressionService.compressImages(filesToCompress);

      // Create previews for compressed files with unique IDs
      // CRITICAL FIX: Ensure each compressed file gets its own unique File object
      // This prevents the issue where multiple camera photos end up referencing the same file
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
      if (version !== this.selectionVersion || !this.isOpen()) return;
      const allPreviews = [...this.filePreviews(), ...newPreviews];
      this.filePreviews.set(allPreviews);
      this.filesSelected.emit(allPreviews.map((p) => p.file));
    } catch (error) {
      console.error('Error processing files:', error);
      this.#notificationService.showError(
        error instanceof Error
          ? error.message
          : this.#translationService.instant('errors.imageCompressionFailed'),
      );
    } finally {
      this.processingCount--;
      this.compressing.set(this.processingCount > 0);
    }
  }

  onUpload(): void {
    if (this.uploading() || this.compressing()) return;
    const files = this.filePreviews().map((p) => p.file);
    const cats = [
      ...new Set(
        this.selectedCategories()
          .map((c) => c.trim())
          .filter(Boolean),
      ),
    ];
    this.upload.emit({
      files,
      groupFiles: this.groupFiles(),
      description: this.description().trim(),
      categories: cats,
      note: this.note().trim(),
    });
  }

  onCancel(): void {
    if (this.uploading()) return;
    this.selectionVersion++;
    this.dragging.set(false);
    this.description.set('');
    this.selectedCategories.set([]);
    this.categoryCustomDraft.set('');
    this.note.set('');
    this.filePreviews.set([]);
    this.compressing.set(this.processingCount > 0);
    this.cancel.emit();
  }

  removeFile(index: number): void {
    const previews = this.filePreviews();
    const updatedPreviews = previews.filter((_, i) => i !== index);
    this.filePreviews.set(updatedPreviews);
    this.filesSelected.emit(updatedPreviews.map((p) => p.file));
  }

  clearAll(): void {
    this.selectionVersion++;
    this.filePreviews.set([]);
    this.description.set('');
    this.selectedCategories.set([]);
    this.categoryCustomDraft.set('');
    this.note.set('');
    this.compressing.set(this.processingCount > 0);
  }

  isCategorySelected(label: string): boolean {
    return this.selectedCategories().includes(label);
  }

  toggleCategory(label: string): void {
    const t = label.trim();
    if (!t) return;
    this.selectedCategories.update((list) =>
      list.includes(t) ? list.filter((c) => c !== t) : [...list, t],
    );
  }

  addCustomCategory(): void {
    const t = this.categoryCustomDraft().trim();
    if (!t) return;
    this.selectedCategories.update((list) => (list.includes(t) ? list : [...list, t]));
    this.categoryCustomDraft.set('');
  }

  removeSelectedCategory(label: string): void {
    this.selectedCategories.update((list) => list.filter((c) => c !== label));
  }
}
