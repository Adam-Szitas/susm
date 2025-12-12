import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectStore } from '../../../store/project.store';
import { ModalService } from '../../../services/modal.service';
import { DEFAULT_WORK_STATUS, formatWorkStatus, WORK_STATUSES } from '@models';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-modal-project',
  templateUrl: './project-modal.component.html',
  styleUrl: './project-modal.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule],
})
export class ModalProjectComponent {
  #formBuilder = inject(FormBuilder);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public readonly statuses = WORK_STATUSES;
  public readonly statusLabel = formatWorkStatus;

  public progressing = signal<boolean>(false);

  public form: FormGroup = this.#formBuilder.group({
    name: ['', [Validators.required]],
    address: this.#formBuilder.group({
      street: [''],
      house_number: [''],
      level: [''],
      door_number: [''],
      postal_code: [''],
    }),
    note: [''],
    status: [DEFAULT_WORK_STATUS, [Validators.required]],
  });

  public Submit(): void {
    const projectData = this.form.getRawValue();
    this.progressing.set(true);
    this.#projectStore.createProject(projectData).subscribe({
      next: () => {
        this.#modalService.close();
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
