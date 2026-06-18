import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { TeamUser, UserRole } from '../../models/user.model';
import { ModalService } from '../../services/modal.service';
import { NotificationService } from '../../services/notification.service';
import { TeamUsersService } from '../../services/team-users.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-team-users-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './team-users-panel.component.html',
  styleUrl: './team-users-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamUsersPanelComponent implements OnInit {
  #fb = inject(FormBuilder);
  #teamUsersService = inject(TeamUsersService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #modalService = inject(ModalService);

  readonly users = signal<TeamUser[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showForm = signal(false);

  readonly roleOptions: UserRole[] = ['member', 'admin'];
  readonly languageOptions = [
    { code: 'en', labelKey: 'languages.english' },
    { code: 'de', labelKey: 'languages.german' },
    { code: 'sk', labelKey: 'languages.slovak' },
  ];

  readonly form = this.#fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(5)]],
    language: ['en', Validators.required],
    role: ['member' as UserRole, Validators.required],
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.#teamUsersService
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => this.users.set(users),
        error: () => {
          this.#notificationService.showError(
            this.#translationService.instant('teamUsers.loadFailed'),
          );
        },
      });
  }

  toggleForm(): void {
    this.showForm.update((open) => !open);
    if (!this.showForm()) {
      this.form.reset({
        name: '',
        email: '',
        password: '',
        language: 'en',
        role: 'member',
      });
    }
  }

  createUser(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.#teamUsersService
      .create({
        ...raw,
        email: raw.email.trim().toLowerCase(),
        name: raw.name.trim(),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (created) => {
          this.users.update((current) => [...current, created]);
          this.#notificationService.showSuccess(
            this.#translationService.instant('teamUsers.created'),
          );
          this.toggleForm();
        },
        error: (error) => {
          const message =
            error?.error?.message ||
            error?.message ||
            this.#translationService.instant('teamUsers.createFailed');
          this.#notificationService.showError(message);
        },
      });
  }

  async deleteUser(user: TeamUser): Promise<void> {
    const userId = user._id?.$oid;
    if (!userId) {
      return;
    }

    const confirmed = await this.#modalService.openConfirm({
      title: 'teamUsers.deleteConfirmTitle',
      message: 'teamUsers.deleteConfirmMessage',
      confirmText: 'common.delete',
      confirmKind: 'danger',
    });
    if (!confirmed) {
      return;
    }

    this.#teamUsersService.delete(userId).subscribe({
      next: () => {
        this.users.update((current) =>
          current.filter((entry) => entry._id?.$oid !== userId),
        );
        this.#notificationService.showSuccess(
          this.#translationService.instant('teamUsers.deleted'),
        );
      },
      error: () => {
        this.#notificationService.showError(
          this.#translationService.instant('teamUsers.deleteFailed'),
        );
      },
    });
  }

  isOwner(user: TeamUser): boolean {
    return user.is_owner;
  }

  roleLabel(role: UserRole): string {
    return role === 'admin'
      ? this.#translationService.instant('teamUsers.roleAdmin')
      : this.#translationService.instant('teamUsers.roleMember');
  }
}
