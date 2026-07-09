import { ChangeDetectionStrategy, Component, inject, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Project } from '@models';
import { HttpService } from '@services/http.service';
import { ModalService } from '@services/modal.service';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TrashIconComponent } from '../../shared/trash-icon.component';
import { compactFormActions } from '../../shared/compact-form-actions';

import { ProjectFormFieldsComponent } from '../../shared/project-form-fields.component';

@Component({
  selector: 'app-edit-project',
  templateUrl: './project-edit.component.html',
  styleUrl: './project-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, TrashIconComponent, ProjectFormFieldsComponent, IconComponent],
})
export class EditProjectComponent implements OnInit {
  protected readonly icons = icons;

  @Input() projectData!: Project;
  #fb = inject(FormBuilder);
  #httpService = inject(HttpService);
  #modalService = inject(ModalService);
  #projectStore = inject(ProjectStore);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #router = inject(Router);
  #userStore = inject(UserStore);

  isAdmin = this.#userStore.isAdmin;
  deleting = signal(false);
  archiving = signal(false);
  readonly iconOnlyActions = compactFormActions();
  public projectForm!: FormGroup;

  isArchived(): boolean {
    return !!this.projectData?.archived_at;
  }

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

  toggleArchive(archive: boolean): void {
    const projectId = this.projectData._id?.$oid;
    if (!projectId || this.archiving() || this.deleting()) return;

    if (archive) {
      const comment = prompt(this.#translationService.instant('projects.archiveCommentPrompt'));
      this.archiving.set(true);
      this.#projectStore.toggleArchiveProject(projectId, true, comment || undefined).subscribe({
        next: () => {
          this.archiving.set(false);
          this.#modalService.close();
          this.#notificationService.showSuccess(
            this.#translationService.instant('projects.archived') || 'Project archived',
          );
        },
        error: (error) => {
          this.archiving.set(false);
          this.#notificationService.showError(
            error.message || this.#translationService.instant('projects.updateError'),
          );
        },
      });
      return;
    }

    this.archiving.set(true);
    this.#projectStore.toggleArchiveProject(projectId, false).subscribe({
      next: () => {
        this.archiving.set(false);
        this.#modalService.close();
        this.#notificationService.showSuccess(
          this.#translationService.instant('projects.unarchiveProject') || 'Project unarchived',
        );
      },
      error: (error) => {
        this.archiving.set(false);
        this.#notificationService.showError(
          error.message || this.#translationService.instant('projects.updateError'),
        );
      },
    });
  }

  async deleteProject(): Promise<void> {
    const projectId = this.projectData._id?.$oid;
    if (!projectId || this.deleting()) return;

    const projectName = this.projectData.name ?? '';
    const message = this.#translationService.instant('projects.deleteProjectConfirm', {
      name: projectName,
    });
    const title = this.#translationService.instant('projects.deleteProject') || 'Delete project';
    const confirmed = await this.#modalService.openConfirm({
      title,
      message,
      confirmText: 'common.delete',
      cancelText: 'common.cancel',
      confirmKind: 'danger',
    });
    if (!confirmed) return;

    this.deleting.set(true);
    this.#projectStore.deleteProject(projectId).subscribe({
      next: () => {
        this.#modalService.close();
        this.#notificationService.showSuccess(
          this.#translationService.instant('projects.projectDeleted'),
        );
        this.deleting.set(false);
        this.#router.navigate(['/projects']);
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('projects.deleteProjectFailed'),
        );
        this.deleting.set(false);
      },
    });
  }
}
