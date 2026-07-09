import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { DEFAULT_WORK_STATUS } from '@models';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TrashIconComponent } from '../../shared/trash-icon.component';
import { StatusSelectComponent } from '../../shared/status-select.component';
import {
  buildHouseNumberRange,
  MAX_HOUSE_NUMBER_RANGE_SIZE,
  parseHouseNumberBound,
} from '../../../utils/house-number-range';
import { resolveObjectPrefix } from '../../../utils/object-prefix';

@Component({
  selector: 'app-new-object',
  templateUrl: './object-modal.component.html',
  styleUrl: './object-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, TrashIconComponent, StatusSelectComponent, IconComponent],
})
export class ObjectModalComponent implements OnInit {
  protected readonly icons = icons;
  #formBuilder = inject(FormBuilder);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #destroyRef = inject(DestroyRef);

  readonly maxRangeSize = MAX_HOUSE_NUMBER_RANGE_SIZE;
  progressing = signal(false);
  readonly #rangePreviewRevision = signal(0);

  readonly form: FormGroup = this.#formBuilder.group({
    status: [DEFAULT_WORK_STATUS, [Validators.required]],
    prefix: [''],
    rangeStart: [''],
    rangeEnd: [''],
    skipExistingHouseNumbers: [true],
    rows: this.#formBuilder.array([]),
  });

  get rowsArray(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  ngOnInit(): void {
    this.addRow();
    for (const controlName of ['rangeStart', 'rangeEnd', 'skipExistingHouseNumbers'] as const) {
      this.form
        .get(controlName)
        ?.valueChanges.pipe(takeUntilDestroyed(this.#destroyRef))
        .subscribe(() => {
          this.#rangePreviewRevision.update((value) => value + 1);
        });
    }
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

  createFromRange(): void {
    if (this.progressing()) {
      return;
    }

    const projectId = this.#projectStore.project()?._id;
    if (!projectId?.$oid) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.noProjectSelected'),
      );
      return;
    }

    const preview = this.getRangePreview();
    if (!preview.valid) {
      this.#notificationService.showError(
        this.#translationService.instant(
          preview.errorKey ?? 'objects.rangeInvalid',
          preview.errorParams ?? {},
        ),
      );
      return;
    }

    const { status, prefix, skipExistingHouseNumbers } = this.form.getRawValue();
    const objects = preview.toCreate.map((house_number) => ({
      address: {
        house_number,
        level: '',
        door_number: '',
      },
      note: '',
      status,
      prefix: resolveObjectPrefix(prefix, house_number),
    }));

    this.#createObjects(projectId, objects, preview.skippedCount, skipExistingHouseNumbers);
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
      }) => {
        const house_number = row.house_number?.trim() ?? '';
        return {
          address: {
            house_number,
            level: row.level?.trim() ?? '',
            door_number: row.door_number?.trim() ?? '',
          },
          note: row.note?.trim() ?? '',
          status,
          prefix: resolveObjectPrefix(prefix, house_number),
        };
      },
    );

    this.#createObjects(projectId, objects);
  }

  #createObjects(
    projectId: { $oid: string },
    objects: {
      address: { house_number: string; level?: string; door_number?: string };
      note: string;
      status: string;
      prefix?: string | null;
    }[],
    skippedCount = 0,
    skippedBecauseExisting = false,
  ): void {
    this.progressing.set(true);
    this.#projectStore.createObjects({ projectId, objects }).subscribe({
      next: (created) => {
        const count = created.length;
        const messageKey =
          skippedBecauseExisting && skippedCount > 0
            ? 'objects.objectsCreatedWithSkipped'
            : count === 1
              ? 'objects.objectCreated'
              : 'objects.objectsCreated';

        this.#notificationService.showSuccess(
          this.#translationService.instant(messageKey, { count, skipped: skippedCount }),
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

  getRangePreview(): {
    valid: boolean;
    totalInRange: number;
    toCreate: string[];
    skippedCount: number;
    errorKey?: string;
    errorParams?: Record<string, unknown>;
  } {
    this.#rangePreviewRevision();
    return this.#buildRangePreview();
  }

  #buildRangePreview(): {
    valid: boolean;
    totalInRange: number;
    toCreate: string[];
    skippedCount: number;
    errorKey?: string;
    errorParams?: Record<string, unknown>;
  } {
    const { rangeStart, rangeEnd, skipExistingHouseNumbers } = this.form.getRawValue();
    const start = parseHouseNumberBound(rangeStart);
    const end = parseHouseNumberBound(rangeEnd);

    if (start === null || end === null) {
      return { valid: false, totalInRange: 0, toCreate: [], skippedCount: 0, errorKey: 'objects.rangeInvalid' };
    }

    const totalInRange = Math.abs(end - start) + 1;
    if (totalInRange > MAX_HOUSE_NUMBER_RANGE_SIZE) {
      return {
        valid: false,
        totalInRange,
        toCreate: [],
        skippedCount: 0,
        errorKey: 'objects.rangeTooLarge',
        errorParams: { max: MAX_HOUSE_NUMBER_RANGE_SIZE },
      };
    }

    const range = buildHouseNumberRange(start, end);
    const existing = skipExistingHouseNumbers
      ? new Set(
          this.#projectStore
            .objects()
            .map((object) => object.address?.house_number?.trim())
            .filter((value): value is string => !!value),
        )
      : new Set<string>();

    const toCreate = skipExistingHouseNumbers
      ? range.filter((houseNumber) => !existing.has(houseNumber))
      : range;

    return {
      valid: toCreate.length > 0,
      totalInRange: range.length,
      toCreate,
      skippedCount: range.length - toCreate.length,
      errorKey: toCreate.length === 0 ? 'objects.rangeAllSkipped' : undefined,
    };
  }
}
