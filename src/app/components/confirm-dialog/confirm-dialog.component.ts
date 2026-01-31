import { Component, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../services/modal.service';

/** Delay before accepting button taps so the tap that opened the modal isn't treated as Cancel (e.g. on mobile). */
const IGNORE_INPUT_MS = 400;

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent implements OnInit {
  @Input() message = '';
  @Input() confirmText = 'common.delete';
  @Input() cancelText = 'common.cancel';
  /** 'danger' for delete actions, 'primary' for normal confirm */
  @Input() confirmKind: 'danger' | 'primary' = 'primary';
  @Input() modalService!: ModalService;

  private handled = false;
  private ready = false;

  ngOnInit(): void {
    setTimeout(() => {
      this.ready = true;
    }, IGNORE_INPUT_MS);
  }

  private canAct(): boolean {
    return this.ready && !this.handled;
  }

  onConfirmTouch(): void {
    if (!this.canAct()) return;
    this.handled = true;
    this.modalService.resolveConfirm(true);
    setTimeout(() => this.modalService.close(), 0);
  }

  handleConfirm(): void {
    if (!this.canAct()) return;
    this.handled = true;
    this.modalService.resolveConfirm(true);
    setTimeout(() => this.modalService.close(), 0);
  }

  onCancelTouch(): void {
    if (!this.canAct()) return;
    this.handled = true;
    this.modalService.resolveConfirm(false);
    setTimeout(() => this.modalService.close(), 0);
  }

  handleCancel(): void {
    if (!this.canAct()) return;
    this.handled = true;
    this.modalService.resolveConfirm(false);
    setTimeout(() => this.modalService.close(), 0);
  }
}
