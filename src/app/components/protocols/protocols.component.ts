import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProtocolService } from '@services/protocol.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProtocolTemplate } from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { ProtocolTemplateModalComponent } from './protocol-template-modal.component';

@Component({
  selector: 'app-protocols',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './protocols.component.html',
  styleUrl: './protocols.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolsComponent implements OnInit {
  #protocolService = inject(ProtocolService);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  templates = signal<ProtocolTemplate[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loading.set(true);
    this.#protocolService.getTemplates().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.loadTemplatesFailed')
        );
        this.loading.set(false);
      },
    });
  }

  createTemplate(): void {
    this.#modalService.open({
      title: 'protocols.createTemplate',
      component: ProtocolTemplateModalComponent,
      wide: true
    });
    // Reload templates after modal closes (you might want to use a subscription for this)
    setTimeout(() => this.loadTemplates(), 500);
  }

  editTemplate(template: ProtocolTemplate): void {
    this.#modalService.open({
      title: 'protocols.editTemplate',
      component: ProtocolTemplateModalComponent,
      wide: true,
      componentInputs: {
        template: template
      }
    });
    // Reload templates after modal closes
    setTimeout(() => this.loadTemplates(), 500);
  }

  deleteTemplate(template: ProtocolTemplate): void {
    const templateId = template._id?.$oid;
    if (!templateId) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.invalidTemplateId')
      );
      return;
    }

    const confirmMessage = this.#translationService.instant('protocols.confirmDelete', {
      name: template.name
    });
    if (!confirm(confirmMessage || `Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    this.#protocolService.deleteTemplate(templateId).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('protocols.templateDeleted')
        );
        this.loadTemplates();
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.deleteFailed')
        );
      },
    });
  }
}

