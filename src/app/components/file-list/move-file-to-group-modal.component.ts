import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ModalService } from '../../services/modal.service';

export interface MoveFileSubGroupTarget {
  subGroupId: string;
  label: string;
}

export interface MoveFileTargetRow {
  groupId: string;
  label: string;
  /** When true, user can move to the group's root-level files. */
  includeGroupRoot?: boolean;
  subGroups?: MoveFileSubGroupTarget[];
}

export interface MoveFileDestination {
  groupId: string;
  subGroupId?: string;
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

  targetRows = input.required<MoveFileTargetRow[]>();

  /** @deprecated Use destinationPicked */
  groupPicked = output<string>();
  destinationPicked = output<MoveFileDestination>();

  pick(groupId: string, subGroupId?: string): void {
    this.destinationPicked.emit({ groupId, subGroupId });
    this.groupPicked.emit(groupId);
    this.#modalService.close();
  }

  cancel(): void {
    this.#modalService.close();
  }
}
