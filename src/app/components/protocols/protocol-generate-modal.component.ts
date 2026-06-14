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
  isUploadedProtocol,
  sortObjectsByStoredOrder,
} from '@models';
import type { Object } from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectStore } from '@store/project.store';
import { ProtocolPreviewComponent, ProtocolPreviewData } from './protocol-preview.component';
import { ToggleSwitchComponent } from '../shared/toggle-switch.component';
import { reorderTargetIdFromTouch } from '../../utils/touch-reorder';

@Component({
  selector: 'app-protocol-generate-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ProtocolPreviewComponent,
    ToggleSwitchComponent,
  ],
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
  /** When true, object order is sent explicitly for this protocol (not project default). */
  customObjectOrder = signal(false);
  /** Ordered selected object IDs for this protocol (used when customObjectOrder is true). */
  protocolObjectOrderIds = signal<string[]>([]);
  /** Full object checklist on the preview step (stable when toggling selection). */
  previewObjectPoolIds = signal<string[]>([]);
  draggedObjectId = signal<string | null>(null);
  dragOverObjectId = signal<string | null>(null);
  #touchProtocolObjectReorderActive = false;
  /** When true, linked protocol order is sent explicitly for this generation. */
  customLinkedProtocolOrder = signal(false);
  protocolLinkedOrderIds = signal<string[]>([]);
  draggedLinkedProtocolId = signal<string | null>(null);
  dragOverLinkedProtocolId = signal<string | null>(null);
  #touchLinkedProtocolReorderActive = false;

  /**
   * Objects listed in the protocol modal: with a date range, only objects that have at least one
   * file in range (using `file_groups` from the API). With category filter, only objects that have
   * a matching file group. On the preview step, the checklist keeps a stable pool of objects so
   * deselected items stay visible and can be re-selected.
   */
  objectsForProtocolSelection = computed(() => {
    this.objects();
    this.#dateRangeVersion();
    this.protocolFileGroupCategories();
    this.previewData();
    this.showingPreview();
    this.customObjectOrder();
    this.protocolObjectOrderIds();
    this.previewObjectPoolIds();

    const all = sortObjectsByStoredOrder(this.objects());
    const fromD = (this.form.get('from_date')?.value as string) ?? '';
    const toD = (this.form.get('to_date')?.value as string) ?? '';
    const catFilter = this.protocolFileGroupCategories().filter((c) => c.trim());

    if (this.showingPreview()) {
      const orderIds =
        this.customObjectOrder() && this.protocolObjectOrderIds().length > 0
          ? this.protocolObjectOrderIds()
          : this.previewObjectPoolIds();
      if (orderIds.length > 0) {
        const order = new Map(orderIds.map((id, i) => [id, i]));
        return all
          .filter((o) => o._id?.$oid && order.has(o._id.$oid))
          .sort((a, b) => (order.get(a._id!.$oid!) ?? 0) - (order.get(b._id!.$oid!) ?? 0));
      }

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

  /** Objects in protocol order on the preview step (selected and unselected). */
  objectsInProtocolOrder = computed(() => {
    this.objectsForProtocolSelection();
    this.customObjectOrder();
    this.protocolObjectOrderIds();

    const available = this.objectsForProtocolSelection();
    if (!this.customObjectOrder()) {
      return available;
    }

    const order = this.protocolObjectOrderIds();
    const byId = new Map(available.map((o) => [o._id!.$oid!, o]));
    const ordered: Object[] = [];
    for (const id of order) {
      const obj = byId.get(id);
      if (obj) {
        ordered.push(obj);
        byId.delete(id);
      }
    }
    for (const obj of byId.values()) {
      ordered.push(obj);
    }
    return ordered;
  });

  /** Linked protocols for preview UI: selected first (merge order), then unselected. */
  linkedProtocolsInOrder = computed(() => {
    this.existingProtocols();
    this.selectedLinkedProtocolIds();
    this.customLinkedProtocolOrder();
    this.protocolLinkedOrderIds();

    const all = this.existingProtocols();
    const selected = new Set(this.selectedLinkedProtocolIds());
    const byId = new Map(all.map((p) => [p._id.$oid, p]));

    const order = this.customLinkedProtocolOrder()
      ? this.protocolLinkedOrderIds()
      : this.selectedLinkedProtocolIds();

    const orderedSelected: ProtocolRecord[] = [];
    for (const id of order) {
      if (!selected.has(id)) continue;
      const protocol = byId.get(id);
      if (protocol) {
        orderedSelected.push(protocol);
      }
    }
    for (const id of selected) {
      if (order.includes(id)) continue;
      const protocol = byId.get(id);
      if (protocol) {
        orderedSelected.push(protocol);
      }
    }

    const unselected = all.filter((p) => p._id?.$oid && !selected.has(p._id.$oid));
    return [...orderedSelected, ...unselected];
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
  /** When on, generated PDF is stored under project → Generated Protocols. */
  saveToProject = signal(true);
  /** When on, project checklist sections appear in preview, TOC, and PDF. */
  includeChecklists = signal(true);

  readonly displayPreviewData = computed(() => {
    const data = this.previewData();
    if (!data) return null;
    if (this.includeChecklists()) return data;
    return this.#stripChecklistsFromMainPreview(data);
  });

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

  formatTemplateSelectLabel(template: ProtocolTemplate): string {
    const subtitle = template.subtitle?.trim();
    return subtitle ? `${template.name} — ${subtitle}` : template.name;
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
      this.#onProtocolFiltersChanged();
    });
    this.form.get('to_date')?.valueChanges.subscribe(() => {
      this.#dateRangeVersion.update((n) => n + 1);
      this.#onProtocolFiltersChanged();
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

  #resetProtocolObjectOrder(): void {
    this.customObjectOrder.set(false);
    this.protocolObjectOrderIds.set([]);
    this.previewObjectPoolIds.set([]);
    this.#touchProtocolObjectReorderActive = false;
    this.draggedObjectId.set(null);
    this.dragOverObjectId.set(null);
  }

  #resetLinkedProtocolOrder(): void {
    this.customLinkedProtocolOrder.set(false);
    this.protocolLinkedOrderIds.set([]);
    this.#touchLinkedProtocolReorderActive = false;
    this.draggedLinkedProtocolId.set(null);
    this.dragOverLinkedProtocolId.set(null);
  }

  #onProtocolFiltersChanged(): void {
    this.#resetProtocolObjectOrder();
    if (this.showingPreview() && this.hasSelection()) {
      this.loadPreview();
    }
  }

  #onLinkedProtocolsChanged(): void {
    this.#resetLinkedProtocolOrder();
    if (this.showingPreview() && this.hasSelection()) {
      this.loadPreview();
    }
  }

  /** Selected object IDs in protocol order (for preview/PDF APIs). */
  #orderedSelectedObjectIds(): string[] {
    const selected = new Set(this.selectedObjectIds());
    if (this.customObjectOrder()) {
      return this.protocolObjectOrderIds().filter((id) => selected.has(id));
    }
    const ordered = sortObjectsByStoredOrder(this.objects())
      .map((o) => o._id?.$oid)
      .filter((id): id is string => !!id && selected.has(id));
    for (const id of this.selectedObjectIds()) {
      if (!ordered.includes(id)) {
        ordered.push(id);
      }
    }
    return ordered;
  }

  #selectedLinkedProtocolOrderBase(): string[] {
    const selected = new Set(this.selectedLinkedProtocolIds());
    if (this.customLinkedProtocolOrder()) {
      const custom = this.protocolLinkedOrderIds().filter((id) => selected.has(id));
      if (custom.length > 0) {
        return custom;
      }
    }
    return this.selectedLinkedProtocolIds().filter((id) => selected.has(id));
  }

  #orderedLinkedProtocolIds(): string[] {
    return this.#selectedLinkedProtocolOrderBase();
  }

  #reorderLinkedPreviewsInPlace(order: string[]): void {
    const preview = this.previewData();
    if (!preview) {
      return;
    }
    const linked = preview.linked_previews;
    if (!linked?.length) {
      return;
    }
    const byId = new Map(
      linked
        .map((lp) => [lp.protocol_id ?? '', lp] as const)
        .filter(([id]) => id.length > 0),
    );
    const reordered = order
      .map((id) => byId.get(id))
      .filter((lp): lp is NonNullable<typeof lp> => !!lp);
    if (reordered.length === 0) {
      return;
    }
    this.previewData.set({ ...preview, linked_previews: reordered });
  }

  #buildGenerateRequest(): GenerateProtocolRequest | null {
    const templateId = this.form.get('template_id')?.value;
    const projectId = this.projectId();
    const objectIds = this.#orderedSelectedObjectIds();

    if (!templateId || templateId === '' || !projectId || objectIds.length === 0) {
      return null;
    }

    const formValue = this.form.value;
    const data: Record<string, unknown> = {};
    if (formValue.fields && Array.isArray(formValue.fields)) {
      for (const field of formValue.fields) {
        data[field.label] = field.value || '';
      }
    }

    const linkedIds = this.#orderedLinkedProtocolIds();
    const fgCats = this.fileGroupCategoriesPayload();

    return {
      template_id: templateId,
      project_id: projectId,
      object_ids: objectIds,
      from_date: formValue.from_date ? this.formatDateForBackend(formValue.from_date) : undefined,
      to_date: formValue.to_date ? this.formatDateForBackend(formValue.to_date, true) : undefined,
      data: Object.keys(data).length > 0 ? data : undefined,
      linked_protocol_ids: linkedIds.length > 0 ? linkedIds : undefined,
      save_to_project: this.saveToProject(),
      custom_object_order: this.customObjectOrder(),
      include_checklists: this.includeChecklists(),
      ...(fgCats ? { file_group_categories: fgCats } : {}),
    };
  }

  /** Hide checklist TOC entries and content in the main preview when toggled off. */
  #stripChecklistsFromMainPreview(data: ProtocolPreviewData): ProtocolPreviewData {
    const todoSections = data.todo_sections ?? [];
    if (todoSections.length === 0) {
      return { ...data, todo_sections: [] };
    }

    const checklistTitles = new Set(todoSections.map((section) => section.title));
    let tocCutIndex = data.table_of_contents.length;
    for (let i = 0; i < data.table_of_contents.length; i++) {
      const entry = data.table_of_contents[i];
      if (entry.level !== 1) continue;

      let matched = 0;
      let j = i + 1;
      while (
        j < data.table_of_contents.length &&
        data.table_of_contents[j].level === 2 &&
        checklistTitles.has(data.table_of_contents[j].title)
      ) {
        matched++;
        j++;
      }

      if (matched > 0 && matched === todoSections.length) {
        tocCutIndex = i;
        break;
      }
    }

    return {
      ...data,
      table_of_contents: data.table_of_contents.slice(0, tocCutIndex),
      todo_sections: [],
    };
  }

  loadPreview(): void {
    const templateId = this.form.get('template_id')?.value;
    if (!templateId || templateId === '' || !this.hasSelection()) {
      return;
    }

    const request = this.#buildGenerateRequest();
    if (!request) {
      return;
    }

    if (!this.showingPreview()) {
      const pool = this.objectsForProtocolSelection()
        .map((o) => o._id?.$oid)
        .filter((id): id is string => !!id);
      if (pool.length > 0) {
        this.previewObjectPoolIds.set(pool);
        if (!this.customObjectOrder()) {
          this.protocolObjectOrderIds.set(pool);
        }
      }
    }

    this.loadingPreview.set(true);
    const formValue = this.form.value;

    this.#protocolService.previewProtocolStructure(request).subscribe({
      next: (previewResponse) => {
        const linkedIds = (previewResponse?.linked_previews ?? [])
          .map((lp: { protocol_id?: string }) => lp.protocol_id)
          .filter((id: string | undefined): id is string => !!id);
        if (linkedIds.length > 0) {
          if (this.customLinkedProtocolOrder()) {
            this.#reorderLinkedPreviewsInPlace(this.#selectedLinkedProtocolOrderBase());
          } else {
            this.protocolLinkedOrderIds.set(linkedIds);
          }
        }
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
    this.#resetProtocolObjectOrder();
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

    const request = this.#buildGenerateRequest();
    const projectId = this.projectId();
    if (!request || !projectId) {
      this.generating.set(false);
      this.#notificationService.showError(
        this.#translationService.instant('protocols.generateMissingData'),
      );
      return;
    }

    const saveToProject = this.saveToProject();

    this.#protocolService.downloadProtocol(request).subscribe({
      next: () => {
        if (saveToProject) {
          this.#projectStore.loadProject(projectId);
        }
        this.generating.set(false);
        this.#notificationService.showSuccess(
          this.#translationService.instant(
            saveToProject ? 'protocols.generated' : 'protocols.generatedDownloadOnly',
          ),
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
    this.#onProtocolFiltersChanged();
  }

  /** Deduplicated non-empty labels sent to preview/PDF endpoints. */
  private fileGroupCategoriesPayload(): string[] | undefined {
    const unique = [
      ...new Set(
        this.protocolFileGroupCategories()
          .map((c) => c.trim())
          .filter(Boolean),
      ),
    ];
    return unique.length > 0 ? unique : undefined;
  }

  toggleSelection(objectId: string | undefined, checked: boolean): void {
    if (!objectId) return;

    const current = this.selectedObjectIds();
    if (checked) {
      if (!current.includes(objectId)) {
        this.selectedObjectIds.set([...current, objectId]);
      }
    } else {
      this.selectedObjectIds.set(current.filter((id) => id !== objectId));
    }
    this.#onObjectSelectionChanged();
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
    this.#onObjectSelectionChanged();
  }

  #onObjectSelectionChanged(): void {
    if (this.showingPreview() && this.hasSelection()) {
      this.loadPreview();
    }
  }

  objectProtocolPosition(object: Object): number {
    const id = object._id?.$oid;
    if (!id) return 0;
    const order = this.customObjectOrder()
      ? this.protocolObjectOrderIds()
      : this.#orderedSelectedObjectIds();
    const index = order.indexOf(id);
    return index === -1 ? 0 : index + 1;
  }

  linkedProtocolPosition(protocol: ProtocolRecord): number {
    const id = protocol._id?.$oid;
    if (!id) return 0;
    const index = this.#selectedLinkedProtocolOrderBase().indexOf(id);
    return index === -1 ? 0 : index + 1;
  }

  #applyProtocolObjectReorder(draggedId: string, targetId: string): void {
    if (draggedId === targetId) return;

    const selected = new Set(this.selectedObjectIds());
    if (!selected.has(draggedId)) return;

    const base =
      this.customObjectOrder() && this.protocolObjectOrderIds().length > 0
        ? [...this.protocolObjectOrderIds()]
        : this.previewObjectPoolIds().length > 0
          ? [...this.previewObjectPoolIds()]
          : this.#orderedSelectedObjectIds();

    const from = base.indexOf(draggedId);
    if (from === -1) return;

    let to = base.indexOf(targetId);
    if (to === -1) {
      to = base.length;
    }

    base.splice(from, 1);
    base.splice(to, 0, draggedId);
    this.customObjectOrder.set(true);
    this.protocolObjectOrderIds.set(base);
    this.loadPreview();
  }

  onProtocolObjectDragStart(event: DragEvent, object: Object): void {
    const id = object._id?.$oid;
    if (!id) return;
    event.stopPropagation();
    this.draggedObjectId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  onProtocolObjectDragOver(event: DragEvent, object: Object): void {
    event.preventDefault();
    const id = object._id?.$oid;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (id && id !== this.draggedObjectId()) {
      this.dragOverObjectId.set(id);
    }
  }

  onProtocolObjectDragLeave(object: Object): void {
    const id = object._id?.$oid;
    if (id && this.dragOverObjectId() === id) {
      this.dragOverObjectId.set(null);
    }
  }

  onProtocolObjectDrop(event: DragEvent, target: Object): void {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = this.draggedObjectId();
    const targetId = target._id?.$oid;
    if (!draggedId || !targetId) {
      this.onProtocolObjectDragEnd();
      return;
    }
    this.#applyProtocolObjectReorder(draggedId, targetId);
    this.onProtocolObjectDragEnd();
  }

  onProtocolObjectDragEnd(): void {
    this.#touchProtocolObjectReorderActive = false;
    this.draggedObjectId.set(null);
    this.dragOverObjectId.set(null);
  }

  onProtocolObjectTouchStart(event: TouchEvent, object: Object): void {
    const id = object._id?.$oid;
    if (!id || !this.isSelected(id)) return;
    event.preventDefault();
    event.stopPropagation();
    this.#touchProtocolObjectReorderActive = true;
    this.draggedObjectId.set(id);
  }

  onProtocolObjectTouchMove(event: TouchEvent): void {
    if (!this.#touchProtocolObjectReorderActive) return;
    event.preventDefault();
    const overId = reorderTargetIdFromTouch(event);
    const draggedId = this.draggedObjectId();
    if (overId && overId !== draggedId) {
      this.dragOverObjectId.set(overId);
    }
  }

  onProtocolObjectTouchEnd(event: TouchEvent): void {
    if (!this.#touchProtocolObjectReorderActive) return;
    event.preventDefault();
    const draggedId = this.draggedObjectId();
    const targetId = reorderTargetIdFromTouch(event) ?? this.dragOverObjectId();
    if (draggedId && targetId) {
      this.#applyProtocolObjectReorder(draggedId, targetId);
    }
    this.onProtocolObjectDragEnd();
  }

  onProtocolObjectTouchCancel(): void {
    if (!this.#touchProtocolObjectReorderActive) return;
    this.onProtocolObjectDragEnd();
  }

  toggleLinkedProtocol(protocolId: string | undefined, checked: boolean): void {
    if (!protocolId) return;
    const current = [...this.selectedLinkedProtocolIds()];
    if (checked) {
      if (!current.includes(protocolId)) {
        current.push(protocolId);
      }
    } else {
      const index = current.indexOf(protocolId);
      if (index !== -1) {
        current.splice(index, 1);
      }
    }
    this.selectedLinkedProtocolIds.set(current);
    this.#onLinkedProtocolsChanged();
  }

  #applyLinkedProtocolReorder(draggedId: string, targetId: string): void {
    if (draggedId === targetId) return;

    const selected = new Set(this.selectedLinkedProtocolIds());
    if (!selected.has(draggedId)) return;

    const base = [...this.#selectedLinkedProtocolOrderBase()];
    const from = base.indexOf(draggedId);
    if (from === -1) return;

    let to = base.indexOf(targetId);
    if (to === -1) {
      to = base.length;
    }

    base.splice(from, 1);
    base.splice(to, 0, draggedId);
    this.customLinkedProtocolOrder.set(true);
    this.protocolLinkedOrderIds.set(base);
    this.selectedLinkedProtocolIds.set(base);
    this.#reorderLinkedPreviewsInPlace(base);
    this.loadPreview();
  }

  onLinkedProtocolDragStart(event: DragEvent, protocol: ProtocolRecord): void {
    const id = protocol._id?.$oid;
    if (!id) return;
    event.stopPropagation();
    this.draggedLinkedProtocolId.set(id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  onLinkedProtocolDragOver(event: DragEvent, protocol: ProtocolRecord): void {
    event.preventDefault();
    const id = protocol._id?.$oid;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (id && id !== this.draggedLinkedProtocolId()) {
      this.dragOverLinkedProtocolId.set(id);
    }
  }

  onLinkedProtocolDragLeave(protocol: ProtocolRecord): void {
    const id = protocol._id?.$oid;
    if (id && this.dragOverLinkedProtocolId() === id) {
      this.dragOverLinkedProtocolId.set(null);
    }
  }

  onLinkedProtocolDrop(event: DragEvent, target: ProtocolRecord): void {
    event.preventDefault();
    event.stopPropagation();
    const draggedId = this.draggedLinkedProtocolId();
    const targetId = target._id?.$oid;
    if (!draggedId || !targetId) {
      this.onLinkedProtocolDragEnd();
      return;
    }
    this.#applyLinkedProtocolReorder(draggedId, targetId);
    this.onLinkedProtocolDragEnd();
  }

  onLinkedProtocolDragEnd(): void {
    this.#touchLinkedProtocolReorderActive = false;
    this.draggedLinkedProtocolId.set(null);
    this.dragOverLinkedProtocolId.set(null);
  }

  onLinkedProtocolTouchStart(event: TouchEvent, protocol: ProtocolRecord): void {
    const id = protocol._id?.$oid;
    if (!id || !this.isLinkedProtocolSelected(protocol)) return;
    event.preventDefault();
    event.stopPropagation();
    this.#touchLinkedProtocolReorderActive = true;
    this.draggedLinkedProtocolId.set(id);
  }

  onLinkedProtocolTouchMove(event: TouchEvent): void {
    if (!this.#touchLinkedProtocolReorderActive) return;
    event.preventDefault();
    const overId = reorderTargetIdFromTouch(event);
    const draggedId = this.draggedLinkedProtocolId();
    if (overId && overId !== draggedId) {
      this.dragOverLinkedProtocolId.set(overId);
    }
  }

  onLinkedProtocolTouchEnd(event: TouchEvent): void {
    if (!this.#touchLinkedProtocolReorderActive) return;
    event.preventDefault();
    const draggedId = this.draggedLinkedProtocolId();
    const targetId = reorderTargetIdFromTouch(event) ?? this.dragOverLinkedProtocolId();
    if (draggedId && targetId) {
      this.#applyLinkedProtocolReorder(draggedId, targetId);
    }
    this.onLinkedProtocolDragEnd();
  }

  onLinkedProtocolTouchCancel(): void {
    if (!this.#touchLinkedProtocolReorderActive) return;
    this.onLinkedProtocolDragEnd();
  }

  isLinkedProtocolSelected(protocol: ProtocolRecord): boolean {
    const id = protocol._id?.$oid;
    return !!id && this.selectedLinkedProtocolIds().includes(id);
  }

  formatProtocolLabel(protocol: ProtocolRecord): string {
    const name = protocol.template_name || '';
    const date = protocol.generated_at ? new Date(protocol.generated_at).toLocaleDateString() : '';
    const objects = protocol.object_names?.length ? protocol.object_names.join(', ') : '';
    const sourceKey = isUploadedProtocol(protocol)
      ? 'protocols.badgeUploaded'
      : 'protocols.badgeGenerated';
    const source = this.#translationService.instant(sourceKey);
    const sourceLabel = source && source !== sourceKey ? source : '';
    return [name, sourceLabel, date, objects].filter(Boolean).join(' · ');
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
      const ms = isEndDate ? Date.UTC(y, m, d, 23, 59, 59, 999) : Date.UTC(y, m, d, 0, 0, 0, 0);
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
