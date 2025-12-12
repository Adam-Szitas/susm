import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProtocolService } from '@services/protocol.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { Object, ProtocolTemplate } from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectStore } from '@store/project.store';
import { ProtocolPreviewComponent } from './protocol-preview.component';

@Component({
  selector: 'app-protocol-generate-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, ProtocolPreviewComponent],
  templateUrl: './protocol-generate-modal.component.html',
  styleUrl: './protocol-generate-modal.component.scss',
})
export class ProtocolGenerateModalComponent {
  #fb = inject(FormBuilder);
  #protocolService = inject(ProtocolService);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #projectStore = inject(ProjectStore);

  projectId = input.required<string>();
  objects = input.required<Object[]>();
  templates = input.required<ProtocolTemplate[]>();

  form: FormGroup;
  generating = signal(false);
  selectedObjectIds = signal<string[]>([]);
  hasSelection = computed(() => this.selectedObjectIds().length > 0);
  #selectionInitialized = signal(false);
  previewData = signal<any>(null);
  showingPreview = signal(false);
  loadingPreview = signal(false);

  #autoSelectObjects = effect(() => {
    const availableObjects = this.objects();
    if (!availableObjects?.length) {
      this.selectedObjectIds.set([]);
      this.#selectionInitialized.set(false);
      return;
    }

    const availableIds = availableObjects
      .map((object) => object._id?.$oid)
      .filter((value): value is string => !!value);

    const currentSelection = this.selectedObjectIds().filter((id) =>
      availableIds.includes(id)
    );

    if (!this.#selectionInitialized()) {
      this.selectedObjectIds.set(currentSelection.length ? currentSelection : availableIds);
      this.#selectionInitialized.set(true);
    } else if (currentSelection.length !== this.selectedObjectIds().length) {
      this.selectedObjectIds.set(currentSelection);
    }
  });

  constructor() {
    this.form = this.#fb.group({
      template_id: ['', [Validators.required]],
    });
  }

  loadPreview(): void {
    if (this.form.invalid || !this.hasSelection()) {
      return;
    }

    const templateId = this.form.value.template_id;
    const projectId = this.projectId();
    const objectIds = this.selectedObjectIds();

    if (!projectId || objectIds.length === 0) {
      return;
    }

    this.loadingPreview.set(true);
    const request = {
      template_id: templateId,
      project_id: projectId,
      object_ids: objectIds,
    };

    this.#protocolService.previewProtocolStructure(request).subscribe({
      next: (data) => {
        this.previewData.set(data);
        this.showingPreview.set(true);
        this.loadingPreview.set(false);
      },
      error: (error) => {
        this.loadingPreview.set(false);
        this.#notificationService.showError(
          error.message || 'Failed to load preview'
        );
      },
    });
  }

  backToForm(): void {
    this.showingPreview.set(false);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.selectTemplate')
      );
      return;
    }

    if (!this.hasSelection()) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.selectObjectsRequired')
      );
      return;
    }

    this.generating.set(true);

    const templateId = this.form.value.template_id;
    const projectId = this.projectId();
    const objectIds = this.selectedObjectIds();

    if (!projectId || objectIds.length === 0) {
      this.generating.set(false);
      this.#notificationService.showError(
        this.#translationService.instant('protocols.generateMissingData')
      );
      return;
    }

    const request = {
      template_id: templateId,
      project_id: projectId,
      object_ids: objectIds,
    };

    this.#protocolService.downloadProtocol(request).subscribe({
      next: () => {
        this.#projectStore.loadProject(projectId);
        this.generating.set(false);
        this.#notificationService.showSuccess(
          this.#translationService.instant('protocols.generated')
        );
        this.#modalService.close();
      },
      error: (error) => {
        this.generating.set(false);
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.generateFailed')
        );
      },
    });
  }

  close(): void {
    this.#modalService.close();
  }

  toggleSelection(objectId: string | undefined, checked: boolean): void {
    if (!objectId) return;

    const current = new Set(this.selectedObjectIds());

    if (checked) {
      current.add(objectId);
    } else {
      current.delete(objectId);
    }

    this.selectedObjectIds.set(Array.from(current));
  }

  isSelected(objectId: string | undefined): boolean {
    if (!objectId) return false;
    return this.selectedObjectIds().includes(objectId);
  }

  formatObjectLabel(object: Object): string {
    const street = object.address?.street ?? '';
    const house = object.address?.house_number ? ` ${object.address?.house_number}` : '';
    const level = object.address?.level ? `, L${object.address?.level}` : '';
    const door = object.address?.door_number ? `, D${object.address?.door_number}` : '';
    return `${street}${house}${level}${door}`.trim() || object._id?.$oid || '';
  }
}

