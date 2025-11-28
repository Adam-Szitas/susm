import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { UserStore } from '../store/user.store';

/**
 * Auth guard that protects routes requiring authentication
 * Waits for user store to initialize before making decisions
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const userStore = inject(UserStore);
  const router = inject(Router);

  // Wait for initialization to complete
  // This prevents premature redirects during page refresh
  while (!userStore.initialized()) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Check if user is authenticated
  if (userStore.isAuthenticated()) {
    return true;
  }

  // Not authenticated - redirect to login and preserve the intended URL
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url }
  });
  
  return false;
};

/**
 * Guard for login/register pages - redirects to projects if already authenticated
 */
export const guestGuard: CanActivateFn = async (route, state) => {
  const userStore = inject(UserStore);
  const router = inject(Router);

  // Wait for initialization to complete
  while (!userStore.initialized()) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // If already authenticated, redirect to projects
  if (userStore.isAuthenticated()) {
    router.navigate(['/projects']);
    return false;
  }

  return true;
};

