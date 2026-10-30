import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpService } from './http.service';

export interface PlatformMetrics {
  companies: number;
  active_users: number;
  active_projects: number;
  archived_projects: number;
  active_objects: number;
  active_files: number;
  generated_protocols: number;
  unused_registration_invites: number;
  protocols_enabled_companies: number;
  protocols_disabled_companies: number;
}

export interface CompanySummary {
  capabilities?: Record<string, boolean>;
  id: string;
  name: string;
  active_users: number;
  active_projects: number;
  active_objects: number;
  active_files: number;
  generated_protocols: number;
  protocols_enabled: boolean;
  protocols_updated_at?: string | null;
  protocols_updated_by?: string | null;
  protocols_reason?: string | null;
}

export interface HealthIssue {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  company_name: string;
  detail: string;
  repairable: boolean;
}

export interface SuperuserOverview {
  metrics: PlatformMetrics;
  companies: CompanySummary[];
  issues: HealthIssue[];
  generated_at: string;
}

export interface FeatureAuditEntry {
  feature?: string;
  id: string;
  enabled: boolean;
  previous_enabled: boolean;
  changed_by: string;
  reason: string;
  changed_at: string;
}

export interface FeatureToggleResponse {
  company_id: string;
  protocols_enabled: boolean;
  protocols_updated_at?: string | null;
  protocols_updated_by?: string | null;
  protocols_reason?: string | null;
  audit_recorded: boolean;
}

export interface OperationalEvent {
  date: string;
  category: string;
  company_name: string;
  user_name: string;
  action: string;
  extra: Record<string, unknown>;
  outcome: 'success' | 'error';
}

export interface OperationsSnapshot {
  range_days: number;
  generated_at: string;
  sample_limited: boolean;
  tracked_events: number;
  successful_sign_ins: number;
  page_views: number;
  request_errors: number;
  by_category: Record<string, number>;
  daily: { date: string; events: number; errors: number }[];
  events: OperationalEvent[];
  health: {
    backend: string;
    backend_version: string;
    uptime_seconds: number;
    database: string;
    database_latency_ms: number | null;
    telemetry: string;
    dropped_events: number;
    checked_at: string;
  };
  partial: boolean;
}

@Injectable({ providedIn: 'root' })
export class PlatformAdminService {
  #http = inject(HttpService);

  getOverview(): Observable<SuperuserOverview> {
    return this.#http.get<SuperuserOverview>('superuser/overview');
  }

  setCapability(companyId: string, feature: string, enabled: boolean, reason: string) {
    return this.#http.put<{ enabled: boolean; audit_recorded: boolean }>(
      `superuser/companies/${companyId}/features/${feature}`,
      { enabled, reason },
    );
  }

  setProtocolsEnabled(
    companyId: string,
    enabled: boolean,
    reason: string,
  ): Observable<FeatureToggleResponse> {
    return this.#http.put<FeatureToggleResponse>(
      `superuser/companies/${companyId}/features/protocols`,
      { enabled, reason },
    );
  }

  getFeatureAudit(companyId: string): Observable<FeatureAuditEntry[]> {
    return this.#http.get<FeatureAuditEntry[]>(`superuser/companies/${companyId}/feature-audit`);
  }

  getOperations(days: number, limit = 100): Observable<OperationsSnapshot> {
    return this.#http.get<OperationsSnapshot>(`superuser/operations?days=${days}&limit=${limit}`);
  }
}
