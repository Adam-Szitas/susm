import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Object } from '@models';
import { HttpService } from '@services/http.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-edit-object',
  templateUrl: './object-edit.component.html',
  styleUrl: './object-edit.component.scss',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditObjectComponent implements OnInit {
  @Input() objectData!: Object;
  #fb = inject(FormBuilder);
  #httpService = inject(HttpService);
  #modalService = inject(ModalService);
  #projectStore = inject(ProjectStore);
  #notificationService = inject(NotificationService);

  public objectForm!: FormGroup;

  ngOnInit(): void {
    this.objectForm = this.#fb.group({
      note: [this.objectData?.note || '', []],
      address: this.#fb.group({
        door_number: [this.objectData?.address?.door_number || '', []],
        level: [this.objectData?.address?.level || '', []],
        postal_code: [this.objectData?.address?.postal_code || '', []],
      }),
    });
  }

  submit() {
    if (!this.objectData._id?.$oid) {
      console.error('Object ID is missing');
      return;
    }

    const data = this.objectForm.value;
    this.#httpService.put<Object>(`object/${this.objectData._id?.$oid}`, data).subscribe({
      next: (response: Object) => {
        this.#modalService.close();
        this.#notificationService.showSuccess('objects.updateSuccess');
        if (response && response._id && response._id.$oid) {
          this.#projectStore.loadObject(response._id.$oid);
        }
      },
      error: (err) => {
        this.#notificationService.showError('objects.updateError');
        console.error('Update failed:', err);
      },
    });
  }
}
