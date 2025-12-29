import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Project } from '@models';
import { HttpService } from '@services/http.service';
import { ModalService } from '@services/modal.service';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '@services/notification.service';

@Component({
  selector: 'app-edit-project',
  templateUrl: './project-edit.component.html',
  styleUrl: './project-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
})
export class EditProjectComponent implements OnInit {
  @Input() projectData!: Project;
  #fb = inject(FormBuilder);
  #httpService = inject(HttpService);
  #modalService = inject(ModalService);
  #projectStore = inject(ProjectStore);
  #notificationService = inject(NotificationService);

  public projectForm!: FormGroup;

  ngOnInit(): void {
    this.projectForm = this.#fb.group({
      name: [this.projectData?.name || '', []],
      note: [this.projectData?.note || '', []],
      address: this.#fb.group({
        street: [this.projectData?.address?.street || '', []],
        postal_code: [this.projectData?.address?.postal_code || '', []],
      }),
    });
  }

  submit() {
    if (!this.projectData._id?.$oid) {
      console.error('Project ID is missing');
      return;
    }

    const formValue = this.projectForm.value;
    // The backend expects a Project structure, but we only send the fields we're updating
    const projectData: Partial<Project> = {
      name: formValue.name || '',
      note: formValue.note || '',
      address: formValue.address || undefined,
    };

    this.#httpService.put<Project>(`project/${this.projectData._id.$oid}`, projectData).subscribe({
      next: (response: Project) => {
        this.#modalService.close();
        this.#notificationService.showSuccess('projects.updateSuccess');
        this.#projectStore.setProject(response);
      },
      error: (err) => {
        this.#notificationService.showError('projects.updateError');
        console.error('Update failed:', err);
      },
    });
  }
}
