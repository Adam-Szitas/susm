import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { EMPTY, Subject } from 'rxjs';
import { PlatformAdminComponent } from './platform-admin.component';
import { CompanySummary, FeatureAuditEntry, PlatformAdminService } from '../../services/platform-admin.service';
import { NotificationService } from '../../services/notification.service';
import { TranslationService } from '../../services/translation.service';
import { UserStore } from '../../store/user.store';

describe('Platform admin company selection', () => {
  it('ignores an old company audit response after selecting another company', () => {
    const a = new Subject<FeatureAuditEntry[]>();
    const b = new Subject<FeatureAuditEntry[]>();
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(),
      { provide: PlatformAdminService, useValue: {
        getOverview: () => EMPTY,
        getOperations: () => EMPTY,
        getFeatureAudit: (id: string) => id === 'a' ? a : b,
      } },
      { provide: NotificationService, useValue: {} },
      { provide: TranslationService, useValue: {} },
      { provide: UserStore, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => new PlatformAdminComponent());
    component.toggleAudit({ id: 'a' } as CompanySummary);
    component.toggleAudit({ id: 'b' } as CompanySummary);
    a.next([{ id: 'a-audit' } as FeatureAuditEntry]);
    a.complete();
    expect(component.auditEntries()).toEqual([]);
    expect(component.auditLoading()).toBeTrue();
    b.next([{ id: 'b-audit' } as FeatureAuditEntry]);
    b.complete();
    expect(component.auditEntries().map(entry => entry.id)).toEqual(['b-audit']);
    expect(component.auditLoading()).toBeFalse();
  });
});
