import { Component, inject, Input, ViewChild, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../services/modal.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent {
  private static nextId = 0;
  readonly titleId = `modal-title-${ModalComponent.nextId++}`;
  @Input() title = 'Modal';
  @Input() showConfirm = false;
  @Input() confirmText = 'Confirm';
  @Input() wide = false;
  @Input() extraWide = false;

  /** Anchor for ModalService.createComponent — must stay in the template. */
  @ViewChild('dynamicContent', { read: ViewContainerRef, static: true })
  dynamicContent!: ViewContainerRef;

  modalService!: ModalService;

  #modalService = inject(ModalService);

  close() {
    this.#modalService.close();
  }

  confirm() {
    this.#modalService.confirm();
  }
}
