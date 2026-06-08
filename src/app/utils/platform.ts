import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** True when running in the browser (not during SSR). */
export function isBrowserPlatform(platformId = inject(PLATFORM_ID)): boolean {
  return isPlatformBrowser(platformId);
}

/** Safe internal URL path for post-login redirect. */
export function safeInternalReturnUrl(url: string | null | undefined, fallback = '/projects'): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return fallback;
  }
  if (url.startsWith('/login') || url.startsWith('/register')) {
    return fallback;
  }
  return url;
}
