import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '@services/modal.service';
import { ProjectStore } from '@store/project.store';
import { DEFAULT_WORK_STATUS, formatWorkStatus, WORK_STATUSES } from '@models';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-new-object',
  templateUrl: './object-modal.component.html',
  styleUrl: './object-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
})
export class ObjectModalComponent {
  #formBuilder = inject(FormBuilder);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public readonly statuses = WORK_STATUSES;
  public readonly statusLabel = formatWorkStatus;
  public progressing = signal<boolean>(false);

  public form: FormGroup = this.#formBuilder.group({
    address: this.#formBuilder.group({
      street: [''],
      house_number: [''],
      level: [''],
      door_number: [''],
    }),
    note: [''],
    status: [DEFAULT_WORK_STATUS, [Validators.required]],
  });

  public Submit(): void {
    const projectData = {
      ...this.form.getRawValue(),
      projectId: this.#projectStore.project()?._id,
    };
    this.progressing.set(true);
    this.#projectStore.createObject(projectData).subscribe({
      next: (result) => {
        this.#modalService.close();
        this.#projectStore.loadObjects();
      },
      error: () => {
        this.progressing.set(false);
      },
      complete: () => {
        this.progressing.set(false);
      },
    });
  }
}
