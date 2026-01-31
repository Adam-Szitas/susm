import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  @Input() message = '';
  @Input() confirmText = 'common.delete';
  @Input() cancelText = 'common.cancel';
  /** 'danger' for delete actions, 'primary' for normal confirm */
  @Input() confirmKind: 'danger' | 'primary' = 'primary';
  @Input() modalService!: ModalService;

  /** Resolve promise immediately so nothing else can override; defer close so touch completes on mobile. */
  handleConfirm(): void {
    this.modalService.resolveConfirm(true);
    setTimeout(() => this.modalService.close(), 0);
  }

  /** Resolve promise immediately; defer close so touch completes on mobile. */
  handleCancel(): void {
    this.modalService.resolveConfirm(false);
    setTimeout(() => this.modalService.close(), 0);
  }
}
