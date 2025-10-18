import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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

  public form: FormGroup = this.#formBuilder.group({
    name: ['', [Validators.required]],
    address: [''],
  });

  public Submit(): void {
    const projectData = this.form.getRawValue();
    console.log('Project Data:', projectData);
  }
}
