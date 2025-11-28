import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectStore } from '../../../store/project.store';
import { ModalService } from '../../../services/modal.service';
import { DEFAULT_WORK_STATUS, formatWorkStatus, WORK_STATUSES } from '@models';

@Component({
  selector: 'app-modal-project',
  templateUrl: './project-modal.component.html',
  styleUrl: './project-modal.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class ModalProjectComponent {
  #formBuilder = inject(FormBuilder);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public readonly statuses = WORK_STATUSES;
  public readonly statusLabel = formatWorkStatus;

  public form: FormGroup = this.#formBuilder.group({
    name: ['', [Validators.required]],
    address: this.#formBuilder.group({
      city: [''],
      street: [''],
      country: [''],
    }),
    note: [''],
    status: [DEFAULT_WORK_STATUS, [Validators.required]],
  });

  public Submit(): void {
    const projectData = this.form.getRawValue();
    this.#projectStore.createProject(projectData).subscribe({
      next: () => {
        this.#modalService.close();
      },
    });
  }
}
