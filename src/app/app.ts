import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';
import { NotificationComponent } from './components/notification/notification.component';
import { TranslationService } from './services/translation.service';
import { UrlPersistenceService } from './services/url-persistence.service';
import { UserStore } from './store/user.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, NotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('susm');
  #translationService = inject(TranslationService);
  #urlPersistenceService = inject(UrlPersistenceService);
  #userStore = inject(UserStore);
  #router = inject(Router);
  #urlRestored = false;
  #isInitialNavigation = true;

  constructor() {
    // Listen to router events to detect initial navigation
    this.#router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (this.#isInitialNavigation) {
          this.#isInitialNavigation = false;
          // After initial navigation, check if we should restore URL
          this.#tryRestoreUrl();
        }
      });

    // Also try to restore URL after user store initializes
    effect(() => {
      if (this.#userStore.initialized() && !this.#isInitialNavigation) {
        this.#tryRestoreUrl();
      }
    });
  }

  #tryRestoreUrl(): void {
    if (this.#urlRestored) return;

    const currentUrl = this.#router.url;
    
    // Don't restore on login/register/share pages
    if (currentUrl.startsWith('/login') || 
        currentUrl.startsWith('/register') || 
        currentUrl.startsWith('/share/')) {
      this.#urlRestored = true;
      return;
    }

    // Only restore if we're on the default route (empty or projects)
    // and user is authenticated
    if ((currentUrl === '/' || currentUrl === '/projects') && 
        this.#userStore.isAuthenticated()) {
      const restored = this.#urlPersistenceService.restoreUrl();
      if (restored) {
        this.#urlRestored = true;
      }
    } else if (currentUrl !== '/' && currentUrl !== '/projects') {
      // We're already on a specific route, mark as restored
      this.#urlRestored = true;
    }
  }

  ngOnInit(): void {
    this.#translationService.initialize();
  }
}
