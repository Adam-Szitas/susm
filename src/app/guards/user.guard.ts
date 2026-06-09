import { inject, PLATFORM_ID } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { UserStore } from '../store/user.store';
import { isBrowserPlatform, safeInternalReturnUrl } from '../utils/platform';

async function waitUntilInitialized(userStore: UserStore): Promise<void> {
  while (!userStore.initialized()) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Auth guard that protects routes requiring authentication.
 * On SSR, defers the check to the browser so deep links survive refresh.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const userStore = inject(UserStore);
  const router = inject(Router);

  if (!isBrowserPlatform(platformId)) {
    return true;
  }

  await waitUntilInitialized(userStore);

  if (userStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

/**
 * Guard for login/register pages — redirects authenticated users to their target URL.
 */
export const guestGuard: CanActivateFn = async (route) => {
  const platformId = inject(PLATFORM_ID);
  const userStore = inject(UserStore);
  const router = inject(Router);

  if (!isBrowserPlatform(platformId)) {
    return true;
  }

  await waitUntilInitialized(userStore);

  if (!userStore.isAuthenticated()) {
    return true;
  }

  const returnUrl = route.queryParamMap.get('returnUrl');
  if (returnUrl) {
    return router.parseUrl(safeInternalReturnUrl(returnUrl));
  }

  return router.createUrlTree(['/projects']);
};
