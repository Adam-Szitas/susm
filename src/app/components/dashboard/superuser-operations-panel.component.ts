import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { HttpService } from '../../services/http.service';
import { ModalService } from '../../services/modal.service';
import { NotificationService } from '../../services/notification.service';
import { TranslationService } from '../../services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

interface PlatformMetrics {
  companies: number;
  active_users: number;
  active_projects: number;
  archived_projects: number;
  active_objects: number;
  active_files: number;
  generated_protocols: number;
  unused_registration_invites: number;
}

interface CompanySummary {
  id: string;
  name: string;
  active_users: number;
  active_projects: number;
  active_objects: number;
  active_files: number;
}

interface HealthIssue {
  code:
    | 'owner_missing_from_users'
    | 'missing_user_role'
    | 'project_missing_id'
    | 'object_missing_id'
    | 'file_missing_path'
    | 'duplicate_user_email'
    | 'duplicate_share_token';
  severity: 'critical' | 'warning' | 'info';
  company_name: string;
  detail: string;
  repairable: boolean;
}

interface SuperuserOverview {
  metrics: PlatformMetrics;
  companies: CompanySummary[];
  issues: HealthIssue[];
  generated_at: string;
}

@Component({
  selector: 'app-superuser-operations-panel',
  standalone: true,
  imports: [TranslateModule, DatePipe, IconComponent],
  templateUrl: './superuser-operations-panel.component.html',
  styleUrl: './superuser-operations-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperuserOperationsPanelComponent {
  protected readonly icons = icons;

  #http = inject(HttpService);
  #modal = inject(ModalService);
  #notifications = inject(NotificationService);
  #translations = inject(TranslationService);

  readonly overview = signal<SuperuserOverview | null>(null);
  readonly loading = signal(false);
  readonly repairing = signal(false);
  readonly error = signal(false);
  readonly showCompanies = signal(false);

  readonly criticalCount = computed(
    () => this.overview()?.issues.filter((issue) => issue.severity === 'critical').length ?? 0,
  );
  readonly warningCount = computed(
    () => this.overview()?.issues.filter((issue) => issue.severity === 'warning').length ?? 0,
  );
  readonly repairableCount = computed(
    () => this.overview()?.issues.filter((issue) => issue.repairable).length ?? 0,
  );

  constructor() {
    this.refresh();
  }

  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.#http
      .get<SuperuserOverview>('superuser/overview')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (overview) => this.overview.set(overview),
        error: () => this.error.set(true),
      });
  }

  async normalizeUserRoles(): Promise<void> {
    if (this.repairing() || this.repairableCount() === 0) return;
    const confirmed = await this.#modal.openConfirm({
      title: 'superuser.repairRolesTitle',
      message: 'superuser.repairRolesConfirm',
      confirmText: 'superuser.repairRoles',
      cancelText: 'common.cancel',
      confirmKind: 'primary',
    });
    if (!confirmed) return;

    this.repairing.set(true);
    this.#http
      .post<{ updated_users: number }>('superuser/maintenance/normalize-user-roles', {})
      .pipe(finalize(() => this.repairing.set(false)))
      .subscribe({
        next: ({ updated_users }) => {
          this.#notifications.showSuccess(
            this.#translations.instant('superuser.rolesRepaired', { count: updated_users }),
          );
          this.refresh();
        },
        error: () =>
          this.#notifications.showError(this.#translations.instant('superuser.repairFailed')),
      });
  }

  issueLabel(issue: HealthIssue): string {
    return `superuser.issue.${issue.code}`;
  }
}
