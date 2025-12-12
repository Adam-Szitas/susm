import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from "@angular/core";
import { HttpService } from '../../services/http.service';
import { DashboardStats } from '../../models';
import { TranslateModule } from '@ngx-translate/core';
import { UserStore } from '../../store/user.store';
import { TranslationService } from '../../services/translation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  imports: [TranslateModule, CommonModule, FormsModule],
})
export class DashboardComponent implements OnInit {
  #httpService = inject(HttpService);
  #userStore = inject(UserStore);
  #translationService = inject(TranslationService);

  public stats = signal<DashboardStats | null>(null);
  public loading = signal(true);
  public currentLanguage = signal<string>('en');
  public availableLanguages = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'sk', label: 'Slovenčina' },
  ];

  constructor() {
    // Watch for user changes and update language
    effect(() => {
      const user = this.#userStore.user();
      if (user?.language) {
        this.currentLanguage.set(user.language);
      } else {
        // Default to current translation service language or 'en'
        const currentLang = this.#translationService.getCurrentLang();
        this.currentLanguage.set(currentLang || 'en');
      }
    });
  }

  ngOnInit(): void {
    this.loadDashboardStats();
    // Initialize current language from user store or translation service
    const userLanguage = this.#userStore.user()?.language || 
                        this.#translationService.getCurrentLang() || 
                        'en';
    this.currentLanguage.set(userLanguage);
  }

  onLanguageChange(language: string): void {
    this.currentLanguage.set(language);
    // Update translation service and wait for translations to load
    this.#translationService.use(language).subscribe({
      next: () => {
        // Translations loaded successfully
        // Update user's language preference in backend
        this.#userStore.updateLanguage(language);
      },
      error: (error) => {
        console.error('Failed to load translations:', error);
        // Still update user preference even if translation load fails
        this.#userStore.updateLanguage(language);
      }
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
}
