import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import {
  CompanySummary,
  FeatureAuditEntry,
  PlatformAdminService,
  SuperuserOverview,
} from '../../services/platform-admin.service';
import { TranslationService } from '../../services/translation.service';
import { UserStore } from '../../store/user.store';

type CompanySort = 'name' | 'projects' | 'files' | 'protocols' | 'protocols_enabled';
type UsageMetric = 'projects' | 'files' | 'protocols';

@Component({
  selector: 'app-platform-admin',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslateModule],
  templateUrl: './platform-admin.component.html',
  styleUrl: './platform-admin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformAdminComponent {
  #adminService = inject(PlatformAdminService);
  #notifications = inject(NotificationService);
  #translations = inject(TranslationService);
  #userStore = inject(UserStore);

  readonly overview = signal<SuperuserOverview | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly search = signal('');
  readonly sortBy = signal<CompanySort>('name');
  readonly usageMetric = signal<UsageMetric>('projects');
  readonly editingCompanyId = signal<string | null>(null);
  readonly reason = signal('');
  readonly savingCompanyId = signal<string | null>(null);
  readonly toggleError = signal<string | null>(null);
  readonly auditCompanyId = signal<string | null>(null);
  readonly auditEntries = signal<FeatureAuditEntry[]>([]);
  readonly auditLoading = signal(false);
  readonly auditError = signal(false);

  readonly visibleCompanies = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const companies = (this.overview()?.companies ?? []).filter(
      (company) => !query || company.name.toLocaleLowerCase().includes(query),
    );
    const sort = this.sortBy();
    return companies.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'projects') return b.active_projects - a.active_projects || a.name.localeCompare(b.name);
      if (sort === 'files') return b.active_files - a.active_files || a.name.localeCompare(b.name);
      if (sort === 'protocols') return b.generated_protocols - a.generated_protocols || a.name.localeCompare(b.name);
      return Number(b.protocols_enabled) - Number(a.protocols_enabled) || a.name.localeCompare(b.name);
    });
  });

  readonly protocolEnabledPercent = computed(() => {
    const metrics = this.overview()?.metrics;
    if (!metrics?.companies) return 0;
    return Math.round((metrics.protocols_enabled_companies / metrics.companies) * 100);
  });

  readonly usageCompanies = computed(() => {
    const key = this.usageMetric();
    return [...(this.overview()?.companies ?? [])]
      .sort((a, b) => this.metricValue(b, key) - this.metricValue(a, key) || a.name.localeCompare(b.name))
      .slice(0, 6);
  });

  readonly maxUsageValue = computed(() =>
    Math.max(1, ...this.usageCompanies().map((company) => this.metricValue(company, this.usageMetric()))),
  );

  constructor() {
    this.refresh();
  }

  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.#adminService
      .getOverview()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (overview) => this.overview.set(overview),
        error: () => this.error.set(true),
      });
  }

  openToggle(company: CompanySummary): void {
    this.editingCompanyId.set(company.id);
    this.reason.set('');
    this.toggleError.set(null);
  }

  cancelToggle(): void {
    this.editingCompanyId.set(null);
    this.reason.set('');
    this.toggleError.set(null);
  }

  saveToggle(company: CompanySummary): void {
    const reason = this.reason().trim();
    if (!reason || reason.length > 500 || this.savingCompanyId()) return;
    const nextEnabled = !company.protocols_enabled;
    this.savingCompanyId.set(company.id);
    this.toggleError.set(null);
    this.#adminService
      .setProtocolsEnabled(company.id, nextEnabled, reason)
      .pipe(finalize(() => this.savingCompanyId.set(null)))
      .subscribe({
        next: (response) => {
          this.overview.update((current) => {
            if (!current) return current;
            const companies = current.companies.map((entry) =>
              entry.id === company.id
                ? {
                    ...entry,
                    protocols_enabled: response.protocols_enabled,
                    protocols_updated_at: response.protocols_updated_at,
                    protocols_updated_by: response.protocols_updated_by,
                    protocols_reason: response.protocols_reason,
                  }
                : entry,
            );
            const metrics = {
              ...current.metrics,
              protocols_enabled_companies: companies.filter((entry) => entry.protocols_enabled).length,
              protocols_disabled_companies: companies.filter((entry) => !entry.protocols_enabled).length,
            };
            return { ...current, companies, metrics };
          });
          this.editingCompanyId.set(null);
          this.reason.set('');
          this.#notifications.showSuccess(this.#translations.instant('admin.featureSaved'));
          if (!response.audit_recorded) {
            this.#notifications.showWarning(this.#translations.instant('admin.auditSaveWarning'));
          }
          if (this.auditCompanyId() === company.id) this.loadAudit(company.id);
          this.#userStore.refreshProfile();
        },
        error: (err) => {
          this.toggleError.set(err?.message || this.#translations.instant('admin.featureSaveFailed'));
        },
      });
  }

  toggleAudit(company: CompanySummary): void {
    if (this.auditCompanyId() === company.id) {
      this.auditCompanyId.set(null);
      this.auditEntries.set([]);
      return;
    }
    this.auditCompanyId.set(company.id);
    this.loadAudit(company.id);
  }

  loadAudit(companyId: string): void {
    this.auditLoading.set(true);
    this.auditError.set(false);
    this.#adminService
      .getFeatureAudit(companyId)
      .pipe(finalize(() => this.auditLoading.set(false)))
      .subscribe({
        next: (entries) => this.auditEntries.set(entries),
        error: () => this.auditError.set(true),
      });
  }

  metricValue(company: CompanySummary, metric: UsageMetric): number {
    if (metric === 'files') return company.active_files;
    if (metric === 'protocols') return company.generated_protocols;
    return company.active_projects;
  }

  usageWidth(company: CompanySummary): number {
    return Math.max(2, Math.round((this.metricValue(company, this.usageMetric()) / this.maxUsageValue()) * 100));
  }

  metricLabel(metric: UsageMetric): string {
    return `admin.metric${metric[0].toUpperCase()}${metric.slice(1)}`;
  }

  logout(): void {
    this.#userStore.logout();
  }
}
