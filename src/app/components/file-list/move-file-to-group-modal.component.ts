import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, take } from 'rxjs';
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

/** Performs the move; the modal stays open until it succeeds and shows the error otherwise. */
export type MoveFileSubmit = (destination: MoveFileDestination) => Observable<unknown>;

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
  #destroyed = false;

  targetRows = input.required<MoveFileTargetRow[]>();
  submit = input<MoveFileSubmit>();

  /** @deprecated Use destinationPicked */
  groupPicked = output<string>();
  destinationPicked = output<MoveFileDestination>();

  /** Key of the destination currently being saved. */
  readonly pendingKey = signal<string | null>(null);
  /** `''` means failed without a server message. */
  readonly error = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.#destroyed = true));
  }

  optionKey(groupId: string, subGroupId?: string): string {
    return subGroupId ? `${groupId}/${subGroupId}` : groupId;
  }

  pick(groupId: string, subGroupId?: string): void {
    if (this.pendingKey()) return;
    const destination: MoveFileDestination = { groupId, subGroupId };
    const submit = this.submit();
    if (!submit) {
      this.#finish(destination);
      return;
    }

    this.error.set(null);
    this.pendingKey.set(this.optionKey(groupId, subGroupId));
    submit(destination)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.pendingKey.set(null);
          // The request outlives an Escape-closed modal; never close whatever modal is on top now.
          if (!this.#destroyed) this.#finish(destination);
        },
        error: (err: unknown) => {
          this.pendingKey.set(null);
          const message = (err as { message?: unknown } | null)?.message;
          this.error.set(typeof message === 'string' ? message : '');
        },
      });
  }

  cancel(): void {
    this.#modalService.close();
  }

  #finish(destination: MoveFileDestination): void {
    this.destinationPicked.emit(destination);
    this.groupPicked.emit(destination.groupId);
    this.#modalService.close();
  }
}
