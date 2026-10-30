import { SeoService } from './services/seo.service';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { NotificationComponent } from './components/notification/notification.component';
import { TranslationService } from './services/translation.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, NotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly title = signal('susm');
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  #translationService = inject(TranslationService);
  #platformId = inject(PLATFORM_ID);
  #destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.#translationService.initialize();
    this.seo.update(this.router.url);
    this.#setupIosScrollRecovery();
  }

  /**
   * iOS Safari can leave the visual viewport offset after pull-to-refresh /
   * rubber-banding. Nudge scroll back when the page becomes visible again.
   */
  #setupIosScrollRecovery(): void {
    if (!isPlatformBrowser(this.#platformId)) {
      return;
    }

    const resetIfStuck = () => {
      if (window.scrollY < 0) {
        window.scrollTo(0, 0);
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted || window.scrollY < 0) {
        window.scrollTo(0, 0);
      }
    };

    const onVisualViewportResize = () => {
      // After chrome show/hide or overscroll, clear a stuck negative offset.
      resetIfStuck();
    };

    window.addEventListener('pageshow', onPageShow);
    window.visualViewport?.addEventListener('resize', onVisualViewportResize);
    window.visualViewport?.addEventListener('scroll', resetIfStuck);

    this.#destroyRef.onDestroy(() => {
      window.removeEventListener('pageshow', onPageShow);
      window.visualViewport?.removeEventListener('resize', onVisualViewportResize);
      window.visualViewport?.removeEventListener('scroll', resetIfStuck);
    });
  }
}
