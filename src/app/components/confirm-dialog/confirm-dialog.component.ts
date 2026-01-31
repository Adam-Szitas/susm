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
}
