import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FileService } from '../../services/file.service';
import { ModalService } from '../../services/modal.service';
import { fileGroupIsSoftDeleted, fileGroupCategoryLabels, FileGroup } from '@models';

export interface ProjectObjectOption {
  objectId: string;
  label: string;
}

export interface SendProjectFileDestination {
  objectId: string;
  groupId: string;
}

export interface SendProjectFileGroupRow {
  groupId: string;
  label: string;
}

@Component({
  selector: 'app-send-project-file-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './send-project-file-modal.component.html',
  styleUrl: './send-project-file-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendProjectFileModalComponent {
  #fileService = inject(FileService);
  #modalService = inject(ModalService);

  objectOptions = input.required<ProjectObjectOption[]>();
  fileCount = input(1);

  destinationConfirmed = output<SendProjectFileDestination>();

  readonly selectedObjectId = signal('');
  readonly selectedGroupId = signal('');
  readonly groupRows = signal<SendProjectFileGroupRow[]>([]);
  readonly loadingGroups = signal(false);

  onObjectChange(objectId: string): void {
    this.selectedObjectId.set(objectId);
    this.selectedGroupId.set('');
    this.groupRows.set([]);

    if (!objectId) {
      this.loadingGroups.set(false);
      return;
    }

    this.loadingGroups.set(true);
    this.#fileService.getFilesForObject(objectId).subscribe({
      next: (groups) => {
        const rows = groups
          .filter((g) => !fileGroupIsSoftDeleted(g))
          .map((g) => {
            const groupId = g._id?.$oid;
            if (!groupId) return null;
            return { groupId, label: this.#groupLabel(g) };
          })
          .filter((r): r is SendProjectFileGroupRow => r !== null);
        this.groupRows.set(rows);
        this.loadingGroups.set(false);
      },
      error: () => {
        this.groupRows.set([]);
        this.loadingGroups.set(false);
      },
    });
  }

  canConfirm(): boolean {
    return !!this.selectedObjectId() && !!this.selectedGroupId() && !this.loadingGroups();
  }

  confirm(): void {
    const objectId = this.selectedObjectId();
    const groupId = this.selectedGroupId();
    if (!objectId || !groupId) return;
    this.destinationConfirmed.emit({ objectId, groupId });
    this.#modalService.close();
  }

  cancel(): void {
    this.#modalService.close();
  }

  #groupLabel(group: FileGroup): string {
    const parts: string[] = [];
    if (group.description?.trim()) parts.push(group.description.trim());
    const cats = fileGroupCategoryLabels(group);
    if (cats.length > 0) parts.push(`(${cats.join(', ')})`);
    return parts.length > 0 ? parts.join(' ') : `Group ${group._id?.$oid?.slice(-6) || ''}`;
  }
}
