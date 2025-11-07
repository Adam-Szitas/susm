import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProjectStore } from '../../../store/project.store';
import { ModalService } from '../../../services/modal.service';

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

  public form: FormGroup = this.#formBuilder.group({
    name: ['', [Validators.required]],
    address: this.#formBuilder.group({
      city: [''],
      street: [''],
      country: [''],
    }),
    note: [''],
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
