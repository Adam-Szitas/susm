import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { KeyValuePipe, TitleCasePipe } from '@angular/common';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import {
  CompanySummary,
  FeatureAuditEntry,
  PlatformAdminService,
  OperationsSnapshot,
  SuperuserOverview,
} from '../../services/platform-admin.service';
import { TranslationService } from '../../services/translation.service';
import { UserStore } from '../../store/user.store';

type CompanySort = 'name' | 'projects' | 'files' | 'protocols' | 'protocols_enabled';
type UsageMetric = 'projects' | 'files' | 'protocols';

@Component({
  selector: 'app-platform-admin',
  standalone: true,
  imports: [DatePipe, KeyValuePipe, TitleCasePipe, FormsModule, TranslateModule],
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
  readonly operations = signal<OperationsSnapshot | null>(null);
  readonly operationsLoading = signal(false);
  readonly operationsError = signal(false);
  readonly operationsDays = signal(7);
  readonly eventCategory = signal('all');
  #operationsRequest = 0;

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

  readonly visibleEvents = computed(() => {
    const events = this.operations()?.events ?? [];
    const category = this.eventCategory();
    return category === 'all' ? events : events.filter((event) => event.category === category);
  });

  constructor() {
    this.refresh();
  }

  refresh(): void {
    if (!this.loading()) {
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
    this.loadOperations();
  }

  loadOperations(): void {
    const requestId = ++this.#operationsRequest;
    this.operationsLoading.set(true);
    this.operationsError.set(false);
    this.#adminService
      .getOperations(this.operationsDays())
      .pipe(finalize(() => {
        if (requestId === this.#operationsRequest) this.operationsLoading.set(false);
      }))
      .subscribe({
        next: (snapshot) => {
          if (requestId === this.#operationsRequest) this.operations.set(snapshot);
        },
        error: () => {
          if (requestId === this.#operationsRequest) this.operationsError.set(true);
        },
      });
  }

  setOperationsDays(days: number): void {
    this.operationsDays.set(days);
    this.loadOperations();
  }

  uptimeLabel(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  activityWidth(events: number, snapshot: OperationsSnapshot): number {
    const max = Math.max(1, ...snapshot.daily.map((day) => day.events));
    return Math.round((events / max) * 100);
  }

  eventCategoryLabel(category: string): string {
    const keys: Record<string, string> = {
      authentication: 'admin.eventAuthentication',
      feature_management: 'admin.eventFeatureManagement',
      protocols: 'admin.eventProtocols',
      projects: 'admin.eventProjects',
      files: 'admin.eventFiles',
      http_errors: 'admin.eventHttpErrors',
      client_tracking: 'admin.eventClientTracking',
    };
    return keys[category] ?? 'admin.eventOther';
  }

  eventActionLabel(action: string): string {
    if (action === 'page_view') return 'admin.actionPageView';
    return this.eventCategoryLabel(action);
  }

  formatEventExtra(extra: Record<string, unknown>): string {
    const parts: string[] = [];
    if (typeof extra['route'] === 'string') parts.push(extra['route']);
    if (typeof extra['method'] === 'string') parts.push(extra['method']);
    if (typeof extra['status'] === 'number') parts.push(`${extra['status']}`);
    if (typeof extra['duration_ms'] === 'number') parts.push(`${extra['duration_ms']} ms`);
    return parts.join(' · ') || '—';
  }

  openToggle(company: CompanySummary): void {
    if (this.savingCompanyId()) return;
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
    this.auditEntries.set([]);
    this.auditLoading.set(true);
    this.auditError.set(false);
    this.#adminService
      .getFeatureAudit(companyId)
      .pipe(finalize(() => {
        if (this.auditCompanyId() === companyId) this.auditLoading.set(false);
      }))
      .subscribe({
        next: (entries) => {
          if (this.auditCompanyId() === companyId) this.auditEntries.set(entries);
        },
        error: () => {
          if (this.auditCompanyId() === companyId) this.auditError.set(true);
        },
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
