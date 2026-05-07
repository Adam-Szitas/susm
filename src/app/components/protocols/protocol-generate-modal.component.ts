import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProtocolService } from '@services/protocol.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import {
  GenerateProtocolRequest,
  FileGroup,
  fileGroupCategoryLabels,
  fileGroupIsSoftDeleted,
  parseMongoDateToMs,
  ProtocolRecord,
  ProtocolTemplate,
} from '@models';
import type { Object } from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectStore } from '@store/project.store';
import { ProtocolPreviewComponent, ProtocolPreviewData } from './protocol-preview.component';

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
  /** Project-defined labels for file-group categories (same list as project tab filter). */
  projectCategories = input<string[]>([]);
  /** Existing protocols for this project (older versions to optionally include in the new PDF). */
  existingProtocols = input<ProtocolRecord[]>([]);

  form: FormGroup;
  generating = signal(false);
  selectedObjectIds = signal<string[]>([]);
  /** IDs of older protocols to include in the generated PDF (rendered first, then new content). */
  selectedLinkedProtocolIds = signal<string[]>([]);
  hasSelection = computed(() => this.selectedObjectIds().length > 0);
  /** Recomputed when protocol date inputs change (form is not a signal). */
  #dateRangeVersion = signal(0);
  /** Selected file-group category labels (multi-select); empty means no category filter. */
  protocolFileGroupCategories = signal<string[]>([]);

  /**
   * Objects listed in the protocol modal: with a date range, only objects that have at least one
   * file in range (using `file_groups` from the API). With category filter, only objects that have
   * a matching file group. After preview is loaded, the list matches `content_sections` from the
   * server (same filter as the PDF).
   */
  objectsForProtocolSelection = computed(() => {
    this.objects();
    this.#dateRangeVersion();
    this.protocolFileGroupCategories();
    this.previewData();
    this.showingPreview();

    const all = this.objects();
    const fromD = (this.form.get('from_date')?.value as string) ?? '';
    const toD = (this.form.get('to_date')?.value as string) ?? '';
    const catFilter = this.protocolFileGroupCategories().filter((c) => c.trim());

    if (this.showingPreview()) {
      const sections = this.previewData()?.content_sections;
      if (sections?.length) {
        const ids = sections.map((s) => s.object_id).filter((id): id is string => !!id);
        if (ids.length > 0) {
          const order = new Map(ids.map((id, i) => [id, i]));
          return all
            .filter((o) => o._id?.$oid && order.has(o._id.$oid))
            .sort((a, b) => (order.get(a._id!.$oid!) ?? 0) - (order.get(b._id!.$oid!) ?? 0));
        }
      }
      return [];
    }

    return all.filter((o) => this.objectMatchesProtocolFilters(o, fromD, toD, catFilter));
  });

  /** Object IDs currently shown in the checklist (respects date range + preview). */
  availableObjectIds = computed(() =>
    this.objectsForProtocolSelection()
      .map((o) => o._id?.$oid)
      .filter((id): id is string => !!id),
  );
  /** True when every listed object is selected (empty list → false). */
  allObjectsSelected = computed(() => {
    const ids = this.availableObjectIds();
    if (ids.length === 0) return false;
    const selected = new Set(this.selectedObjectIds());
    return ids.every((id) => selected.has(id));
  });
  #selectionInitialized = signal(false);
  previewData = signal<ProtocolPreviewData | null>(null);
  showingPreview = signal(false);
  loadingPreview = signal(false);

  selectedTemplate = computed(() => {
    const templateId = this.form.get('template_id')?.value;
    if (!templateId || templateId === '') return null;
    return this.templates().find((t) => t._id?.$oid === templateId) || null;
  });

  get fieldControls(): FormArray {
    return this.form.get('fields') as FormArray;
  }

  // Get template for preview view (directly from form, not computed signal)
  get templateForPreview(): ProtocolTemplate | null {
    const templateId = this.form.get('template_id')?.value;
    if (!templateId || templateId === '') return null;
    return this.templates().find((t) => t._id?.$oid === templateId) || null;
  }

  // Check if form is valid for preview (excluding template fields validation)
  get isFormValidForPreview(): boolean {
    const templateIdControl = this.form.get('template_id');
    const hasValue = !!templateIdControl?.value && templateIdControl.value !== '';
    // For preview, we just need a value - don't check valid state which might be false due to required fields
    const isValid = hasValue;
    return isValid;
  }

  #autoSelectObjects = effect(() => {
    const availableObjects = this.objectsForProtocolSelection();
    if (!availableObjects?.length) {
      this.selectedObjectIds.set([]);
      this.#selectionInitialized.set(false);
      return;
    }

    const availableIds = availableObjects
      .map((object) => object._id?.$oid)
      .filter((value): value is string => !!value);

    const currentSelection = this.selectedObjectIds().filter((id) => availableIds.includes(id));

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
      from_date: [''],
      to_date: [''],
      fields: this.#fb.array([]),
    });

    // Watch for template changes and update fields
    this.form.get('template_id')?.valueChanges.subscribe(() => {
      this.updateTemplateFields();
    });

    this.form.get('from_date')?.valueChanges.subscribe(() => {
      this.#dateRangeVersion.update((n) => n + 1);
    });
    this.form.get('to_date')?.valueChanges.subscribe(() => {
      this.#dateRangeVersion.update((n) => n + 1);
    });
  }

  updateTemplateFields(): void {
    // Get templateId directly from form, not from computed signal
    const templateId = this.form.get('template_id')?.value;
    if (!templateId || templateId === '') {
      // Clear fields if no template selected
      const fieldsArray = this.fieldControls;
      while (fieldsArray.length !== 0) {
        fieldsArray.removeAt(0);
      }
      return;
    }

    // Find template directly
    const template = this.templates().find((t) => t._id?.$oid === templateId);
    const fieldsArray = this.fieldControls;

    // Clear existing fields
    while (fieldsArray.length !== 0) {
      fieldsArray.removeAt(0);
    }

    if (template && template.fields) {
      // Add form controls for each template field
      for (const field of template.fields) {
        // Don't add required validators here - we'll validate manually on submit
        // This allows preview even with empty required fields
        fieldsArray.push(
          this.#fb.group({
            label: [field.label],
            value: [''],
            field_type: [field.field_type],
          }),
        );
      }
    }
  }

  loadPreview(): void {
    const templateId = this.form.get('template_id')?.value;
    if (!templateId || templateId === '' || !this.hasSelection()) {
      return;
    }

    const projectId = this.projectId();
    const objectIds = this.selectedObjectIds();

    if (!projectId || objectIds.length === 0) {
      return;
    }

    this.loadingPreview.set(true);
    const formValue = this.form.value;

    // Build data object from template fields - include all fields even if empty
    const data: Record<string, unknown> = {};
    if (formValue.fields && Array.isArray(formValue.fields)) {
      for (const field of formValue.fields) {
        // Include field even if empty, so it shows up in preview
        data[field.label] = field.value || '';
      }
    }

    const linkedIds = this.selectedLinkedProtocolIds();
    const fgCats = this.fileGroupCategoriesPayload();
    const request: GenerateProtocolRequest = {
      template_id: templateId,
      project_id: projectId,
      object_ids: objectIds,
      from_date: formValue.from_date ? this.formatDateForBackend(formValue.from_date) : undefined,
      to_date: formValue.to_date ? this.formatDateForBackend(formValue.to_date, true) : undefined,
      data: Object.keys(data).length > 0 ? data : undefined,
      linked_protocol_ids: linkedIds.length > 0 ? linkedIds : undefined,
      ...(fgCats ? { file_group_categories: fgCats } : {}),
    };

    this.#protocolService.previewProtocolStructure(request).subscribe({
      next: (previewResponse) => {
        console.log(previewResponse);
        this.previewData.set(previewResponse);
        // Ensure fields are still populated when showing preview
        // Use template_id from form to get the template, not selectedTemplate() signal
        const tid = formValue.template_id;
        const template =
          tid && tid !== '' ? this.templates().find((t) => t._id?.$oid === tid) : null;

        if (template && template.fields) {
          // Re-populate fields if they were cleared or if count doesn't match
          if (this.fieldControls.controls.length !== template.fields.length) {
            this.updateTemplateFields();
          }

          // Restore field values from the form data that was sent
          if (formValue.fields && Array.isArray(formValue.fields)) {
            for (
              let i = 0;
              i < formValue.fields.length && i < this.fieldControls.controls.length;
              i++
            ) {
              const fieldControl = this.fieldControls.controls[i] as FormGroup;
              if (fieldControl && formValue.fields[i]) {
                fieldControl.patchValue({ value: formValue.fields[i].value || '' });
              }
            }
          }
        }
        this.showingPreview.set(true);
        this.loadingPreview.set(false);
      },
      error: (error) => {
        this.loadingPreview.set(false);
        this.#notificationService.showError(error.message || 'Failed to load preview');
      },
    });
  }

  backToForm(): void {
    this.showingPreview.set(false);
    // Ensure fields are still populated when going back
    this.updateTemplateFields();
  }

  onSubmit(): void {
    // Check template_id
    if (!this.form.get('template_id')?.valid) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.selectTemplate'),
      );
      return;
    }

    if (!this.hasSelection()) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.selectObjectsRequired'),
      );
      return;
    }

    // Validate required template fields manually
    const fieldsArray = this.fieldControls;
    const templateIdForValidation = this.form.get('template_id')?.value;
    const template = templateIdForValidation
      ? this.templates().find((t) => t._id?.$oid === templateIdForValidation)
      : null;

    if (template && template.fields) {
      for (let i = 0; i < template.fields.length; i++) {
        const field = template.fields[i];
        if (field.required) {
          const fieldControl = fieldsArray.controls[i] as FormGroup;
          const value = fieldControl?.get('value')?.value;
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            this.#notificationService.showError(
              `${this.#translationService.instant('protocols.fieldRequired')}: ${field.label}`,
            );
            fieldControl?.get('value')?.markAsTouched();
            return;
          }
        }
      }
    }

    this.generating.set(true);

    const templateId = this.form.value.template_id;
    const projectId = this.projectId();
    const objectIds = this.selectedObjectIds();

    if (!projectId || objectIds.length === 0) {
      this.generating.set(false);
      this.#notificationService.showError(
        this.#translationService.instant('protocols.generateMissingData'),
      );
      return;
    }

    const formValue = this.form.value;

    // Build data object from template fields - include all fields even if empty
    const data: Record<string, unknown> = {};
    if (formValue.fields && Array.isArray(formValue.fields)) {
      for (const field of formValue.fields) {
        // Include field even if empty, so it shows up in PDF
        data[field.label] = field.value || '';
      }
    }

    const linkedIds = this.selectedLinkedProtocolIds();
    const fgCats = this.fileGroupCategoriesPayload();
    const request: GenerateProtocolRequest = {
      template_id: templateId,
      project_id: projectId,
      object_ids: objectIds,
      from_date: formValue.from_date ? this.formatDateForBackend(formValue.from_date) : undefined,
      to_date: formValue.to_date ? this.formatDateForBackend(formValue.to_date, true) : undefined,
      data: Object.keys(data).length > 0 ? data : undefined,
      linked_protocol_ids: linkedIds.length > 0 ? linkedIds : undefined,
      ...(fgCats ? { file_group_categories: fgCats } : {}),
    };

    this.#protocolService.downloadProtocol(request).subscribe({
      next: () => {
        this.#projectStore.loadProject(projectId);
        this.generating.set(false);
        this.#notificationService.showSuccess(
          this.#translationService.instant('protocols.generated'),
        );
        this.#modalService.close();
      },
      error: (error) => {
        this.generating.set(false);
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.generateFailed'),
        );
      },
    });
  }

  close(): void {
    this.#modalService.close();
  }

  isProtocolCategorySelected(category: string): boolean {
    return this.protocolFileGroupCategories().includes(category);
  }

  toggleProtocolCategory(category: string, checked: boolean): void {
    const next = new Set(this.protocolFileGroupCategories());
    if (checked) {
      next.add(category);
    } else {
      next.delete(category);
    }
    this.protocolFileGroupCategories.set(Array.from(next));
    if (this.showingPreview() && this.previewData() && this.hasSelection()) {
      this.loadPreview();
    }
  }

  /** Deduplicated non-empty labels sent to preview/PDF endpoints. */
  private fileGroupCategoriesPayload(): string[] | undefined {
    const unique = [...new Set(this.protocolFileGroupCategories().map((c) => c.trim()).filter(Boolean))];
    return unique.length > 0 ? unique : undefined;
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

  toggleSelectAllObjects(): void {
    const ids = this.availableObjectIds();
    if (ids.length === 0) return;
    if (this.allObjectsSelected()) {
      this.selectedObjectIds.set([]);
    } else {
      this.selectedObjectIds.set([...ids]);
    }
  }

  toggleLinkedProtocol(protocolId: string | undefined, checked: boolean): void {
    if (!protocolId) return;
    const current = new Set(this.selectedLinkedProtocolIds());
    if (checked) {
      current.add(protocolId);
    } else {
      current.delete(protocolId);
    }
    this.selectedLinkedProtocolIds.set(Array.from(current));
  }

  isLinkedProtocolSelected(protocol: ProtocolRecord): boolean {
    const id = protocol._id?.$oid;
    return !!id && this.selectedLinkedProtocolIds().includes(id);
  }

  formatProtocolLabel(protocol: ProtocolRecord): string {
    const name = protocol.template_name || '';
    const date = protocol.generated_at ? new Date(protocol.generated_at).toLocaleDateString() : '';
    const objects = protocol.object_names?.length ? protocol.object_names.join(', ') : '';
    return [name, date, objects].filter(Boolean).join(' · ');
  }

  formatObjectLabel(object: Object): string {
    // ObjectAddress only has level, door_number, and postal_code
    const houseNumber = object.address?.house_number ? `${object.address?.house_number}, ` : '';
    const level = object.address?.level ? `${object.address?.level}, ` : '';
    const door = object.address?.door_number ? `${object.address?.door_number}` : '';

    return `${houseNumber}${level}${door}`.trim() || object._id?.$oid || '';
  }

  /**
   * Date range + optional file-group categories (matches backend `collect_objects_for_protocol`).
   */
  private objectMatchesProtocolFilters(
    obj: Object,
    fromInput: string,
    toInput: string,
    categoryLabels: string[],
  ): boolean {
    const groups = obj.file_groups;
    if (!groups?.length) {
      return categoryLabels.length === 0;
    }

    const fromIso = fromInput.trim() ? this.formatDateForBackend(fromInput.trim(), false) : null;
    const toIso = toInput.trim() ? this.formatDateForBackend(toInput.trim(), true) : null;
    const fromMs = fromIso ? Date.parse(fromIso) : null;
    const toMs = toIso ? Date.parse(toIso) : null;
    const hasDateConstraint = fromMs !== null || toMs !== null;
    const catSet = categoryLabels.length > 0 ? new Set(categoryLabels) : null;

    for (const g of groups as FileGroup[]) {
      if (fileGroupIsSoftDeleted(g)) {
        continue;
      }

      const rawFiles = g.files ?? [];
      const activeFiles = rawFiles.filter((f) => f.deleted_at == null);
      const hadAnyFileRecord = rawFiles.length > 0;

      // Metadata-only groups: backend always includes (category filter does not apply).
      if (!hadAnyFileRecord) {
        if (!hasDateConstraint) {
          return true;
        }
        continue;
      }

      const labels = fileGroupCategoryLabels(g);
      if (catSet && !labels.some((l) => catSet.has(l))) {
        continue;
      }

      if (activeFiles.length === 0) {
        continue;
      }

      if (!hasDateConstraint) {
        return true;
      }

      for (const f of activeFiles) {
        const t = parseMongoDateToMs(f.created_at);
        if (t === null) {
          continue;
        }
        const okFrom = fromMs === null || t >= fromMs;
        const okTo = toMs === null || t <= toMs;
        if (okFrom && okTo) {
          return true;
        }
      }
    }
    return false;
  }

  private formatDateForBackend(dateString: string, isEndDate = false): string {
    if (!dateString) return '';

    const trimmed = dateString.trim();
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (ymd) {
      const y = Number(ymd[1]);
      const m = Number(ymd[2]) - 1;
      const d = Number(ymd[3]);
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
      const ms = isEndDate
        ? Date.UTC(y, m, d, 23, 59, 59, 999)
        : Date.UTC(y, m, d, 0, 0, 0, 0);
      return new Date(ms).toISOString();
    }

    const date = new Date(trimmed);
    if (isNaN(date.getTime())) return '';
    if (isEndDate) {
      date.setUTCHours(23, 59, 59, 999);
    } else {
      date.setUTCHours(0, 0, 0, 0);
    }
    return date.toISOString();
  }

  getFieldInputType(fieldType: string): string {
    switch (fieldType) {
      case 'date':
        return 'date';
      case 'number':
        return 'number';
      default:
        return 'text';
    }
  }
}
