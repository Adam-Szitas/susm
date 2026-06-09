import { isPlatformBrowser } from '@angular/common';

/** True when running in the browser (pass PLATFORM_ID from the injector). */
export function isBrowserPlatform(platformId: object): boolean {
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
