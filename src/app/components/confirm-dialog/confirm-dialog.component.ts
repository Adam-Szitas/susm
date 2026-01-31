import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

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
  @Input() onConfirm: () => void = () => {};
  @Input() onCancel: () => void = () => {};

  /** Defer callback to next tick so touch/click completes on mobile (e.g. iOS Safari). */
  handleConfirm(): void {
    setTimeout(() => this.onConfirm(), 0);
  }

  /** Defer callback to next tick so touch/click completes on mobile. */
  handleCancel(): void {
    setTimeout(() => this.onCancel(), 0);
  }
}
