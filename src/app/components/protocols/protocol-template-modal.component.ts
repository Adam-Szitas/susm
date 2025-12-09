import { Component, inject, Input, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ProtocolService } from '@services/protocol.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProtocolField, FieldType, ProtocolTemplate } from '@models';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

const FIELD_TYPES: FieldType[] = ['text', 'number', 'date', 'address', 'status', 'note', 'custom'];

@Component({
  selector: 'app-protocol-template-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './protocol-template-modal.component.html',
  styleUrl: './protocol-template-modal.component.scss',
})
export class ProtocolTemplateModalComponent implements OnInit {
  #fb = inject(FormBuilder);
  #protocolService = inject(ProtocolService);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  @Input() template?: ProtocolTemplate;

  form: FormGroup;
  fieldTypes = FIELD_TYPES;
  saving = signal(false);
  previewing = signal(false);
  isEditing = signal(false);

  constructor() {
    this.form = this.#fb.group({
      name: ['', [Validators.required]],
      description: [''],
      header_template: [''],
      footer_template: [''],
      fields: this.#fb.array([]),
    });
  }

  ngOnInit(): void {
    if (this.template) {
      this.isEditing.set(true);
      this.populateForm(this.template);
    }
  }

  populateForm(template: ProtocolTemplate): void {
    this.form.patchValue({
      name: template.name,
      description: template.description || '',
      header_template: template.header_template || '',
      footer_template: template.footer_template || '',
    });

    // Clear existing fields
    while (this.fields.length !== 0) {
      this.fields.removeAt(0);
    }

    // Add fields from template
    if (template.fields && template.fields.length > 0) {
      template.fields.forEach((field) => {
        const fieldType = this.getFieldTypeValue(field.field_type);
        const customFieldName = fieldType === 'custom' && typeof field.field_type === 'object' && 'custom' in field.field_type
          ? (field.field_type as { custom: string }).custom
          : '';

        const fieldGroup = this.#fb.group({
          label: [field.label, [Validators.required]],
          field_type: [fieldType, [Validators.required]],
          required: [field.required || false],
          order: [field.order || 0],
          custom_field_name: [customFieldName],
        });
        this.fields.push(fieldGroup);
      });
    }
  }

  getFieldTypeValue(fieldType: FieldType): string {
    if (typeof fieldType === 'string') {
      return fieldType;
    }
    if (typeof fieldType === 'object' && 'custom' in fieldType) {
      return 'custom';
    }
    return 'text';
  }

  get fields(): FormArray {
    return this.form.get('fields') as FormArray;
  }

  addField(): void {
    const fieldGroup = this.#fb.group({
      label: ['', [Validators.required]],
      field_type: ['text', [Validators.required]],
      required: [false],
      order: [this.fields.length],
      custom_field_name: [''],
    });
    this.fields.push(fieldGroup);
  }

  removeField(index: number): void {
    this.fields.removeAt(index);
    // Update order values
    this.fields.controls.forEach((control, i) => {
      control.patchValue({ order: i });
    });
  }

  getFieldType(field: AbstractControl): FieldType {
    const fieldGroup = field as FormGroup;
    return fieldGroup.get('field_type')?.value || 'text';
  }

  isCustomField(field: AbstractControl): boolean {
    return this.getFieldType(field) === 'custom';
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.formInvalid'),
      );
      return;
    }

    this.saving.set(true);

    const formValue = this.form.value;
    const fields: ProtocolField[] = formValue.fields.map((field: any) => {
      // For custom fields, we need to send the custom field name
      // The backend expects Custom(String) where String is the field name
      let fieldType: FieldType | any = field.field_type;

      if (field.field_type === 'custom') {
        // Always send as object format: { custom: "field_name" }
        // Use the custom_field_name if provided, otherwise use the label as fallback
        const customName = field.custom_field_name || field.label || 'custom_field';
        fieldType = { custom: customName };
      }

      return {
        label: field.label,
        field_type: fieldType,
        required: field.required || false,
        order: field.order || 0,
      };
    });

    const template = {
      name: formValue.name,
      description: formValue.description || undefined,
      fields,
      header_template: formValue.header_template || undefined,
      footer_template: formValue.footer_template || undefined,
    };

    const templateId = this.template?._id?.$oid;
    
    if (templateId && this.isEditing()) {
      // Update existing template
      this.#protocolService.updateTemplate(templateId, template).subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('protocols.templateUpdated'),
          );
          this.saving.set(false);
          this.#modalService.close();
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('protocols.updateFailed'),
          );
          this.saving.set(false);
        },
      });
    } else {
      // Create new template
      this.#protocolService.createTemplate(template).subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('protocols.templateCreated'),
          );
          this.saving.set(false);
          this.#modalService.close();
        },
        error: (error) => {
          this.#notificationService.showError(
            error.message || this.#translationService.instant('protocols.createFailed'),
          );
          this.saving.set(false);
        },
      });
    }
  }

  close(): void {
    this.#modalService.close();
  }

  preview(): void {
    if (this.form.invalid) {
      this.#notificationService.showError(
        this.#translationService.instant('protocols.formInvalid'),
      );
      return;
    }

    this.previewing.set(true);

    const formValue = this.form.value;
    const fields: ProtocolField[] = formValue.fields.map((field: any) => {
      // For custom fields, we need to send the custom field name
      // The backend expects Custom(String) where String is the field name
      let fieldType: FieldType | any = field.field_type;

      if (field.field_type === 'custom') {
        // Always send as object format: { custom: "field_name" }
        // Use the custom_field_name if provided, otherwise use the label as fallback
        const customName = field.custom_field_name || field.label || 'custom_field';
        fieldType = { custom: customName };
      }

      return {
        label: field.label,
        field_type: fieldType,
        required: field.required || false,
        order: field.order || 0,
      };
    });

    const template = {
      name: formValue.name,
      description: formValue.description || undefined,
      fields,
      header_template: formValue.header_template || undefined,
      footer_template: formValue.footer_template || undefined,
    };

    this.#protocolService.openPreview(template).subscribe({
      next: () => {
        this.previewing.set(false);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('protocols.previewFailed'),
        );
        this.previewing.set(false);
      },
    });
  }
}
