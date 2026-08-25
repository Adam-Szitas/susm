import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpService } from '../../services/http.service';
import { DashboardStats, ProjectStats } from '../../models';
import { TranslateModule } from '@ngx-translate/core';
import { UserStore } from '../../store/user.store';
import { TranslationService } from '../../services/translation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { TeamUsersPanelComponent } from './team-users-panel.component';
import { RegistrationInvitePanelComponent } from './registration-invite-panel.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  imports: [
    TranslateModule,
    CommonModule,
    FormsModule,
    RouterLink,
    TeamUsersPanelComponent,
    RegistrationInvitePanelComponent,
    IconComponent,
  ],
})
export class DashboardComponent implements OnInit {
  protected readonly icons = icons;

  #httpService = inject(HttpService);
  #userStore = inject(UserStore);
  #translationService = inject(TranslationService);

  readonly isAdmin = this.#userStore.isAdmin;
  readonly isCompanyOwner = this.#userStore.isCompanyOwner;
  readonly currentUserName = computed(() => this.#userStore.user()?.name?.trim() || '');
  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(true);
  /** TEMPORARY — remove with claim-superuser endpoint once ownership is fixed. */
  readonly claimingSuperuser = signal(false);
  readonly claimSuperuserError = signal<string | null>(null);
  readonly currentLanguage = signal<string>('en');
  readonly availableLanguages = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'sk', label: 'Slovenčina' },
  ];

  readonly activeProjectsCount = computed(() => {
    const data = this.stats();
    if (!data) return 0;
    return Math.max(0, data.total_projects - (data.archived_projects_count ?? 0));
  });

  readonly totalFilesCount = computed(() => {
    const data = this.stats();
    if (!data) return 0;
    return data.project_files_count + data.object_files_count;
  });

  readonly topProjects = computed((): ProjectStats[] => {
    const projects = this.stats()?.projects_with_objects ?? [];
    if (!projects.length) return [];
    return [...projects].sort((a, b) => b.object_count - a.object_count).slice(0, 5);
  });

  constructor() {
    effect(() => {
      const user = this.#userStore.user();
      if (user?.language) {
        this.currentLanguage.set(user.language);
      } else {
        const currentLang = this.#translationService.getCurrentLang();
        this.currentLanguage.set(currentLang || 'en');
      }
    });
  }

  ngOnInit(): void {
    this.loadDashboardStats();
    const userLanguage =
      this.#userStore.user()?.language || this.#translationService.getCurrentLang() || 'en';
    this.currentLanguage.set(userLanguage);
  }

  onLanguageChange(language: string): void {
    this.currentLanguage.set(language);
    this.#translationService.use(language).subscribe({
      next: () => {
        this.#userStore.updateLanguage(language);
      },
      error: (error) => {
        console.error('Failed to load translations:', error);
        this.#userStore.updateLanguage(language);
      },
    });
  }

  loadDashboardStats(): void {
    this.loading.set(true);
    this.#httpService.get<DashboardStats>('dashboard/stats').subscribe({
      next: (result) => {
        this.stats.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load dashboard stats:', error);
        this.loading.set(false);
      },
    });
  }

  /** TEMPORARY — remove with BE claim-superuser once ownership is fixed. */
  claimSuperuser(): void {
    if (this.claimingSuperuser() || this.isCompanyOwner()) {
      return;
    }
    this.claimingSuperuser.set(true);
    this.claimSuperuserError.set(null);
    this.#userStore.claimCompanySuperuser().subscribe({
      next: () => {
        this.claimingSuperuser.set(false);
        this.loadDashboardStats();
      },
      error: (error) => {
        console.error('Failed to claim superuser:', error);
        this.claimingSuperuser.set(false);
        this.claimSuperuserError.set('dashboard.claimSuperuserFailed');
      },
    });
  }
}
