import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

const STORAGE_KEY = 'last_visited_url';

@Injectable({ providedIn: 'root' })
export class UrlPersistenceService {
  #router = inject(Router);
  #isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Store URL on navigation
      this.#router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          // Only store URLs that are not login/register pages
          if (!event.urlAfterRedirects.startsWith('/login') && 
              !event.urlAfterRedirects.startsWith('/register') &&
              !event.urlAfterRedirects.startsWith('/share/')) {
            this.storeUrl(event.urlAfterRedirects);
          }
        });

      // Store URL before page unload
      window.addEventListener('beforeunload', () => {
        const currentUrl = this.#router.url;
        if (currentUrl && 
            !currentUrl.startsWith('/login') && 
            !currentUrl.startsWith('/register') &&
            !currentUrl.startsWith('/share/')) {
          this.storeUrl(currentUrl);
        }
      });

      this.#isInitialized = true;
    }
  }

  /**
   * Store the current URL in localStorage
   */
  storeUrl(url: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, url);
    } catch (error) {
      console.warn('Failed to store URL:', error);
    }
  }

  /**
   * Get the stored URL from localStorage
   */
  getStoredUrl(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to retrieve stored URL:', error);
      return null;
    }
  }

  /**
   * Clear the stored URL
   */
  clearStoredUrl(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear stored URL:', error);
    }
  }

  /**
   * Restore the stored URL if it exists and is valid
   * Returns true if navigation was attempted, false otherwise
   */
  restoreUrl(): boolean {
    const storedUrl = this.getStoredUrl();
    
    if (!storedUrl) {
      return false;
    }

    // Don't restore login/register/share URLs
    if (storedUrl.startsWith('/login') || 
        storedUrl.startsWith('/register') ||
        storedUrl.startsWith('/share/')) {
      this.clearStoredUrl();
      return false;
    }

    // Check if the URL is valid (starts with /)
    if (!storedUrl.startsWith('/')) {
      this.clearStoredUrl();
      return false;
    }

    try {
      // Navigate to the stored URL
      this.#router.navigateByUrl(storedUrl).catch((error) => {
        console.warn('Failed to navigate to stored URL:', storedUrl, error);
        // If navigation fails, clear the stored URL
        this.clearStoredUrl();
      });
      return true;
    } catch (error) {
      console.warn('Error restoring URL:', error);
      this.clearStoredUrl();
      return false;
    }
  }
}

