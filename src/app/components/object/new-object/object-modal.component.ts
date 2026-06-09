import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { DEFAULT_WORK_STATUS, formatWorkStatus, WORK_STATUSES } from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { TrashIconComponent } from '../../shared/trash-icon.component';

@Component({
  selector: 'app-new-object',
  templateUrl: './object-modal.component.html',
  styleUrl: './object-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, TrashIconComponent],
})
export class ObjectModalComponent implements OnInit {
  #formBuilder = inject(FormBuilder);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);

  readonly statuses = WORK_STATUSES;
  readonly statusLabel = formatWorkStatus;
  progressing = signal(false);

  readonly form: FormGroup = this.#formBuilder.group({
    status: [DEFAULT_WORK_STATUS, [Validators.required]],
    prefix: [''],
    rows: this.#formBuilder.array([]),
  });

  get rowsArray(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  ngOnInit(): void {
    this.addRow();
  }

  createRowGroup(): FormGroup {
    return this.#formBuilder.group({
      house_number: ['', Validators.required],
      level: [''],
      door_number: [''],
      note: [''],
    });
  }

  addRow(): void {
    this.rowsArray.push(this.createRowGroup());
  }

  removeRow(index: number): void {
    if (this.rowsArray.length <= 1) return;
    this.rowsArray.removeAt(index);
  }

  submit(): void {
    if (this.form.invalid || this.progressing()) return;

    const projectId = this.#projectStore.project()?._id;
    if (!projectId?.$oid) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.noProjectSelected'),
      );
      return;
    }

    const { status, prefix } = this.form.getRawValue();
    const objects = this.rowsArray.getRawValue().map(
      (row: {
        house_number: string;
        level: string;
        door_number: string;
        note: string;
      }) => ({
        address: {
          house_number: row.house_number?.trim() ?? '',
          level: row.level?.trim() ?? '',
          door_number: row.door_number?.trim() ?? '',
        },
        note: row.note?.trim() ?? '',
        status,
        prefix: prefix?.trim() || null,
      }),
    );

    this.progressing.set(true);
    this.#projectStore.createObjects({ projectId, objects }).subscribe({
      next: (created) => {
        const count = created.length;
        this.#notificationService.showSuccess(
          this.#translationService.instant(
            count === 1 ? 'objects.objectCreated' : 'objects.objectsCreated',
            { count },
          ),
        );
        this.#modalService.close();
        this.#projectStore.loadObjects();
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('objects.bulkCreateFailed'),
        );
        this.progressing.set(false);
      },
      complete: () => {
        this.progressing.set(false);
      },
    });
  }
}
