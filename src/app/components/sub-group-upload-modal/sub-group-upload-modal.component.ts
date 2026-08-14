import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ImageCompressionService } from '@services/image-compression.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TrashIconComponent } from '../shared/trash-icon.component';
import { compactFormActions } from '../shared/compact-form-actions';
import { lockDocumentScroll, unlockDocumentScroll } from '@services/document-scroll-lock';

interface FilePreview {
  file: globalThis.File;
  previewUrl: string;
  uniqueId: string;
}

export interface SubGroupUploadPayload {
  name: string;
  categories: string[];
  note: string;
  files: globalThis.File[];
}

@Component({
  selector: 'app-sub-group-upload-modal',
  standalone: true,
  imports: [TranslateModule, FormsModule, TrashIconComponent, IconComponent],
  templateUrl: './sub-group-upload-modal.component.html',
  styleUrl: './sub-group-upload-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubGroupUploadModalComponent implements OnDestroy {
  protected readonly icons = icons;
  readonly iconOnlyActions = compactFormActions();

  #document = inject(DOCUMENT);
  #hostRef = inject(ElementRef<HTMLElement>);
  #imageCompressionService = inject(ImageCompressionService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #bodyPortalPlaceholder: Comment | null = null;

  constructor() {
    effect((onCleanup) => {
      if (!this.isOpen()) {
        this.#restoreFromBodyPortal();
        return;
      }
      this.#attachToBodyPortal();
      lockDocumentScroll();
      onCleanup(() => {
        this.#restoreFromBodyPortal();
        unlockDocumentScroll();
      });
    });

    effect(() => {
      if (!this.isOpen()) {
        return;
      }
      if (this.addMode()) {
        this.name.set(this.initialName().trim());
        this.selectedCategories.set([...this.initialCategories()]);
        this.note.set(this.initialNote().trim());
      }
    });
  }

  ngOnDestroy(): void {
    this.#restoreFromBodyPortal();
  }

  /** Render above nested modals (e.g. sub-group detail) by escaping scroll/stacking contexts. */
  #attachToBodyPortal(): void {
    const host = this.#hostRef.nativeElement;
    if (host.parentElement === this.#document.body) {
      return;
    }
    const parent = host.parentNode;
    if (!parent) {
      return;
    }
    this.#bodyPortalPlaceholder = this.#document.createComment('sub-group-upload-modal');
    parent.insertBefore(this.#bodyPortalPlaceholder, host);
    this.#document.body.appendChild(host);
  }

  #restoreFromBodyPortal(): void {
    const host = this.#hostRef.nativeElement;
    const placeholder = this.#bodyPortalPlaceholder;
    if (!placeholder?.parentNode || host.parentElement !== this.#document.body) {
      return;
    }
    placeholder.parentNode.insertBefore(host, placeholder);
    placeholder.remove();
    this.#bodyPortalPlaceholder = null;
  }

  isOpen = input<boolean>(false);
  categories = input<string[]>([]);
  uploading = input<boolean>(false);
  /** When true, only files are required (add photos to existing sub-group). */
  addMode = input<boolean>(false);
  initialName = input<string>('');
  initialCategories = input<string[]>([]);
  initialNote = input<string>('');

  upload = output<SubGroupUploadPayload>();
  cancel = output<void>();

  name = signal('');
  selectedCategories = signal<string[]>([]);
  categoryCustomDraft = signal('');
  note = signal('');
  filePreviews = signal<FilePreview[]>([]);
  compressing = signal(false);

  canSave(): boolean {
    if (this.uploading() || this.compressing()) {
      return false;
    }
    if (this.filePreviews().length === 0) {
      return false;
    }
    if (!this.addMode() && !this.name().trim()) {
      return false;
    }
    return true;
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      input.value = '';
      return;
    }

    const files = Array.from(input.files);
    const imageFiles = files.filter((file) => this.#imageCompressionService.isImageFile(file));

    if (imageFiles.length === 0) {
      input.value = '';
      return;
    }

    const existingUniqueIds = new Set(this.filePreviews().map((p) => p.uniqueId));

    const newFilesWithIds = imageFiles.map((file, index) => ({
      file,
      uniqueId: `${Date.now()}-${index}-${Math.random().toString(36).substring(2, 15)}-${file.name}-${file.size}`,
    }));

    const filesToProcess = newFilesWithIds.filter(({ uniqueId }) => !existingUniqueIds.has(uniqueId));

    if (filesToProcess.length === 0) {
      input.value = '';
      return;
    }

    this.compressing.set(true);
    try {
      const filesToCompress = filesToProcess.map(({ file }) => file);
      const compressedFiles = await this.#imageCompressionService.compressImages(filesToCompress);

      const currentPreviews = [...this.filePreviews()];
      const previewPromises = compressedFiles.map((compressedFile, index) => {
        return new Promise<FilePreview>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error(`Failed to read file: ${compressedFile.name}`));
          reader.onload = (e: ProgressEvent<FileReader>) => {
            const uniqueFileName = `${Date.now()}-${index}-${compressedFile.name}`;
            const uniqueFile = new File([compressedFile], uniqueFileName, {
              type: compressedFile.type,
              lastModified: Date.now() + index,
            });

            resolve({
              file: uniqueFile,
              previewUrl: e.target?.result as string,
              uniqueId: filesToProcess[index].uniqueId,
            });
          };
          reader.readAsDataURL(compressedFile);
        });
      });

      const newPreviews = await Promise.all(previewPromises);
      this.filePreviews.set([...currentPreviews, ...newPreviews]);
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
      input.value = '';
    }
  }

  onUpload(): void {
    if (!this.canSave()) {
      return;
    }
    const cats = [...new Set(this.selectedCategories().map((c) => c.trim()).filter(Boolean))];
    this.upload.emit({
      name: this.name().trim() || this.initialName().trim(),
      categories: cats,
      note: this.note().trim(),
      files: this.filePreviews().map((p) => p.file),
    });
  }

  onCancel(): void {
    this.resetForm();
    this.cancel.emit();
  }

  removeFile(index: number): void {
    const previews = this.filePreviews();
    this.filePreviews.set(previews.filter((_, i) => i !== index));
  }

  clearAll(): void {
    this.filePreviews.set([]);
    this.compressing.set(false);
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

  private resetForm(): void {
    this.name.set('');
    this.selectedCategories.set([]);
    this.categoryCustomDraft.set('');
    this.note.set('');
    this.filePreviews.set([]);
    this.compressing.set(false);
  }
}
