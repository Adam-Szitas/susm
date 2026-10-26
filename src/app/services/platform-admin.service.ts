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

@Injectable({ providedIn: 'root' })
export class PlatformAdminService {
  #http = inject(HttpService);

  getOverview(): Observable<SuperuserOverview> {
    return this.#http.get<SuperuserOverview>('superuser/overview');
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
    return this.#http.get<FeatureAuditEntry[]>(
      `superuser/companies/${companyId}/feature-audit`,
    );
  }
}
