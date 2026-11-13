import { CommonModule } from '@angular/common';
import { computed, NO_ERRORS_SCHEMA, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { User, FeatureFlags } from '@models';
import { UserStore } from '@store/user.store';
import { HttpService } from '@services/http.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { CompanyFeaturesPanelComponent } from './company-features-panel.component';
import { DashboardComponent } from './dashboard.component';

describe('company admin feature overview', () => {
  const flags: FeatureFlags = {
    protocols: { enabled: true },
    externalSharing: { enabled: false },
    trash: { enabled: true },
    streetPlan: { enabled: false },
  };
  let user: ReturnType<typeof signal<User | null>>;
  let verified: ReturnType<typeof signal<boolean>>;
  let refresh: jasmine.Spy;

  beforeEach(() => {
    verified = signal(true);
    user = signal<User | null>({
      name: 'Admin',
      email: 'admin@example.test',
      role: 'admin',
      feature_flags: flags,
    });
    refresh = jasmine.createSpy();
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: UserStore,
          useValue: {
            user,
            profileVerified: verified,
            refreshProfile: refresh,
            isAdmin: computed(() => user()?.role === 'admin'),
            isSuperuser: computed(() => verified() && user()?.is_superuser === true),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: () =>
              of({
                total_projects: 0,
                total_objects: 0,
                project_files_count: 0,
                object_files_count: 0,
                projects_with_objects: [],
              }),
          },
        },
        { provide: TranslationService, useValue: { getCurrentLang: () => 'en' } },
      ],
    });
  });

  function panel() {
    const fixture = TestBed.createComponent(CompanyFeaturesPanelComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows all four features and their examples, including disabled features, to company admins', () => {
    const fixture = panel();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.feature-card').length).toBe(4);
    expect(host.querySelectorAll('[data-state=enabled]').length).toBe(2);
    expect(host.querySelectorAll('[data-state=disabled]').length).toBe(2);
    for (const card of host.querySelectorAll('.feature-card')) {
      expect(card.querySelector('figure figcaption')?.textContent).toContain(
        'featureOverview.example',
      );
      expect(card.querySelector('figure p')?.textContent).toContain('.example');
      expect(card.querySelector('h3')?.textContent).toContain('admin.features.');
    }
    expect(
      host.querySelectorAll('[data-state=disabled] a, [data-state=disabled] button').length,
    ).toBe(0);
    expect(host.querySelector('[data-feature=protocols] a')?.getAttribute('href')).toBe(
      '/protocols',
    );
    expect(host.querySelector('[data-feature=trash] a')?.getAttribute('href')).toBe(
      '/files/removed',
    );
    expect(host.querySelectorAll('button, input[type=checkbox], [role=switch]').length).toBe(0);
  });

  it('updates availability reactively without hiding disabled examples or unlocking them', () => {
    const fixture = panel();
    user.set({
      ...user()!,
      feature_flags: { ...flags, protocols: { enabled: false }, streetPlan: { enabled: true } },
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-feature=protocols]')?.getAttribute('data-state')).toBe(
      'disabled',
    );
    expect(host.querySelector('[data-feature=protocols] a')).toBeNull();
    expect(host.querySelector('[data-feature=streetPlan] a')?.getAttribute('href')).toBe(
      '/projects',
    );
    expect(host.querySelectorAll('figure').length).toBe(4);
  });

  it('does not describe unverified or missing flags as disabled or expose enabled links', () => {
    verified.set(false);
    const fixture = panel();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('[data-state=unknown]').length).toBe(4);
    expect(host.querySelector('a')).toBeNull();
    verified.set(true);
    user.set({ ...user()!, feature_flags: undefined });
    fixture.detectChanges();
    expect(host.querySelectorAll('[data-state=unknown]').length).toBe(4);
    expect(host.querySelector('a')).toBeNull();
  });

  it('hides the overview from members and allows verified platform admins', () => {
    user.set({ ...user()!, role: 'member' });
    const fixture = panel();
    expect(fixture.nativeElement.querySelector('.company-features')).toBeNull();
    user.set({ ...user()!, is_superuser: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.feature-card').length).toBe(4);
    user.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.company-features')).toBeNull();
  });

  it('includes the overview on the dashboard for admins and refreshes the existing profile', () => {
    TestBed.overrideComponent(DashboardComponent, {
      set: {
        imports: [
          CommonModule,
          FormsModule,
          RouterLink,
          TranslateModule,
          IconComponent,
          CompanyFeaturesPanelComponent,
        ],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelectorAll('.feature-card').length).toBe(4);
    user.set({ ...user()!, role: 'member' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-company-features-panel')).toBeNull();
  });
});
