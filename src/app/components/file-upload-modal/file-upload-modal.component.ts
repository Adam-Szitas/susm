import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
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

    // Create previews for new files only
    const currentPreviews = [...this.filePreviews()];
    let loadedCount = 0;
    const newPreviews: FilePreview[] = [];

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        newPreviews.push({
          file,
          previewUrl: e.target?.result as string,
        });
        loadedCount++;
        
        // When all new files are loaded, append them to existing previews
        if (loadedCount === newFiles.length) {
          const allPreviews = [...currentPreviews, ...newPreviews];
          this.filePreviews.set(allPreviews);
          this.filesSelected.emit(allPreviews.map(p => p.file));
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input to allow selecting more files
    input.value = '';
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
  }
}

