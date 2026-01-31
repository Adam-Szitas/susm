import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { FileService } from '../../services/file.service';

export interface RemovedFileItem {
  object_name: string;
  filename: string;
}

@Component({
  selector: 'app-removed-files',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink],
  templateUrl: './removed-files.component.html',
  styleUrl: './removed-files.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemovedFilesComponent implements OnInit {
  #fileService = inject(FileService);

  removed = signal<RemovedFileItem[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRemoved();
  }

  loadRemoved(): void {
    this.loading.set(true);
    this.error.set(null);
    this.#fileService.getRemovedFiles().subscribe({
      next: (list) => {
        this.removed.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message || 'Failed to load removed files');
        this.loading.set(false);
      },
    });
  }
}
