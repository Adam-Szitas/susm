import { Component, inject, Input } from '@angular/core';
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
  @Input() title = 'Modal';
  @Input() showConfirm = false;
  @Input() confirmText = 'Confirm';
  @Input() wide = false;

  modalService!: ModalService;

  #modalService = inject(ModalService);

  close() {
    this.#modalService.close();
  }

  confirm() {
    this.#modalService.confirm();
  }
}
