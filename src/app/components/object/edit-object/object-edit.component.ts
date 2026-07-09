import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Object, DEFAULT_WORK_STATUS } from '@models';
import { HttpService } from '@services/http.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TrashIconComponent } from '../../shared/trash-icon.component';
import { compactFormActions } from '../../shared/compact-form-actions';

import { ObjectFormFieldsComponent } from '../../shared/object-form-fields.component';

@Component({
  selector: 'app-edit-object',
  templateUrl: './object-edit.component.html',
  styleUrl: './object-edit.component.scss',
  imports: [ReactiveFormsModule, TranslateModule, TrashIconComponent, ObjectFormFieldsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class EditObjectComponent implements OnInit {
  protected readonly icons = icons;

  @Input() objectData!: Object;
  objectUpdated = output<Object>();
  #fb = inject(FormBuilder);
  #httpService = inject(HttpService);
  #modalService = inject(ModalService);
  #projectStore = inject(ProjectStore);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #router = inject(Router);
  #userStore = inject(UserStore);

  isAdmin = this.#userStore.isAdmin;
  readonly iconOnlyActions = compactFormActions();
  public progressing = signal<boolean>(false);
  public deleting = signal<boolean>(false);
  public form!: FormGroup;

  ngOnInit(): void {
    // Match the same structure as create object modal
    this.form = this.#fb.group({
      address: this.#fb.group({
        house_number: [this.objectData?.address?.house_number || '', Validators.required],
        level: [this.objectData?.address?.level || ''],
        door_number: [this.objectData?.address?.door_number || ''],
      }),
      note: [this.objectData?.note || ''],
      status: [this.objectData?.status || DEFAULT_WORK_STATUS, [Validators.required]],
      prefix: [this.objectData?.prefix || ''],
    });
  }

  submit(): void {
    if (!this.objectData._id?.$oid) {
      this.#notificationService.showError(
        this.#translationService.instant('errors.objectIdNotFound'),
      );
      return;
    }

    if (this.form.invalid) {
      this.#notificationService.showError(this.#translationService.instant('errors.formInvalid'));
      return;
    }

    this.progressing.set(true);
    const raw = this.form.getRawValue();
    // Explicitly include note (even when empty) so the backend persists the removal
    const data = {
      ...raw,
      note: raw.note ?? '',
    };

    this.#httpService.put<Object>(`object/${this.objectData._id.$oid}`, data).subscribe({
      next: (response: Object) => {
        this.#modalService.close();
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.updateSuccess'),
        );

        // Trigger store to refetch the object data
        if (response && response._id?.$oid) {
          this.#projectStore.loadObject(response._id.$oid).subscribe({
            next: (reloadedObject) => {
              // Emit the output event with the updated object
              if (reloadedObject) {
                this.objectUpdated.emit(reloadedObject);
              }
            },
          });
        }
        // Also reload objects list to reflect changes
        this.#projectStore.loadObjects();
      },
      error: (err) => {
        this.#notificationService.showError(
          err.message || this.#translationService.instant('objects.updateError'),
        );
        this.progressing.set(false);
        console.error('Update failed:', err);
      },
      complete: () => {
        this.progressing.set(false);
      },
    });
  }

  async deleteObject(): Promise<void> {
    const objectId = this.objectData._id?.$oid;
    if (!objectId || this.deleting()) return;

    const message = this.#translationService.instant('objects.deleteObjectConfirm');
    const title = this.#translationService.instant('objects.deleteObject') || 'Delete Object';
    const confirmed = await this.#modalService.openConfirm({
      title,
      message,
      confirmText: 'common.delete',
      cancelText: 'common.cancel',
      confirmKind: 'danger',
    });
    if (!confirmed) return;

    this.deleting.set(true);
    this.#projectStore.deleteObject(objectId).subscribe({
      next: () => {
        this.#modalService.close();
        this.#notificationService.showSuccess(
          this.#translationService.instant('objects.objectDeleted'),
        );
        this.deleting.set(false);
        this.#router.navigate(['/objects']);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('objects.deleteObjectFailed'),
        );
        this.deleting.set(false);
      },
    });
  }
}
