import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModalService } from '@services/modal.service';
import { ProjectStore } from '@store/project.store';

@Component({
  selector: 'app-new-object',
  templateUrl: './object-modal.component.html',
  styleUrl: './object-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class ObjectModalComponent {
  #formBuilder = inject(FormBuilder);
  #projectStore = inject(ProjectStore);
  #modalService = inject(ModalService);

  public form: FormGroup = this.#formBuilder.group({
    address: this.#formBuilder.group({
      city: [''],
      street: [''],
      country: [''],
    }),
    note: [''],
  });

  public Submit(): void {
    const projectData = {
      ...this.form.getRawValue(),
      projectId: this.#projectStore.project()?._id,
    };
    this.#projectStore.createObject(projectData).subscribe({
      next: (result) => {
        this.#modalService.close();
        this.#projectStore.loadObjects();
      },
    });
  }
}
