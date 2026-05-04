import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ModalService } from '../../services/modal.service';

export interface MoveFileTargetRow {
  groupId: string;
  label: string;
}

@Component({
  selector: 'app-move-file-to-group-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './move-file-to-group-modal.component.html',
  styleUrl: './move-file-to-group-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveFileToGroupModalComponent {
  #modalService = inject(ModalService);

  /** Destination groups (excludes the file’s current group). */
  targetRows = input.required<MoveFileTargetRow[]>();

  groupPicked = output<string>();

  pick(groupId: string): void {
    this.groupPicked.emit(groupId);
    this.#modalService.close();
  }

  cancel(): void {
    this.#modalService.close();
  }
}
