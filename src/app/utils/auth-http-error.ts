import { HttpErrorResponse } from '@angular/common/http';

/** Login/register — never trigger session logout on failed auth. */
export function isAuthFreeRequestUrl(url: string): boolean {
  return (
    url.includes('/login') ||
    url.includes('/register') ||
    url.includes('/public/registration-invite')
  );
}

/** Session renewal failures are handled by UserStore; avoid duplicate logout handling. */
export function isSessionRenewRequestUrl(url: string): boolean {
  return url.includes('/session/renew');
}

/** Read error string from common API shapes (Actix, JSON, plain). */
function errorBodyToString(err: HttpErrorResponse): string {
  const e = err.error;
  if (typeof e === 'string') {
    return e;
  }
  if (e && typeof e === 'object') {
    const rec = e as Record<string, unknown>;
    if (rec['error'] != null) {
      return String(rec['error']);
    }
    if (rec['message'] != null) {
      return String(rec['message']);
    }
  }
  return (err.message || '').toString();
}

/**
 * Heuristic: response indicates invalid/expired session (not a generic 404
 * like "Object not found").
 */
export function responseIndicatesAuthSessionInvalid(err: HttpErrorResponse): boolean {
  const text = (errorBodyToString(err) + ' ' + (err.statusText || '')).toLowerCase();
  if (!text.trim()) {
    return false;
  }
  if (
    text.includes('invalid or expired token') ||
    text.includes('invalid token') ||
    text.includes('token expired') ||
    text.includes('expired token') ||
    text.includes('missing or invalid authorization') ||
    (text.includes('unauthorized') && (text.includes('token') || text.includes('session'))) ||
    text.includes('not authenticated') ||
    text.includes('invalid session')
  ) {
    return true;
  }
  // Broad but common API wording
  if (text.includes('jwt') && (text.includes('expired') || text.includes('invalid'))) {
    return true;
  }
  return false;
}

/**
 * Whether the client should clear session and send the user to login.
 * Covers 401/403 and misconfigured/legacy 404+auth message bodies.
 */
export function shouldLogoutOnHttpError(err: HttpErrorResponse, requestUrl: string): boolean {
  if (isAuthFreeRequestUrl(requestUrl)) {
    return false;
  }
  if (err.status === 401) {
    return true;
  }
  if (err.status === 403) {
    return responseIndicatesAuthSessionInvalid(err);
  }
  if (err.status === 404) {
    return responseIndicatesAuthSessionInvalid(err);
  }
  return false;
}

/** True when a 404 means the requested entity is gone (not an auth/session 404). */
export function isMissingResource404(error: {
  status?: number;
  originalError?: unknown;
}): boolean {
  if (error.status !== 404) {
    return false;
  }
  const original = error.originalError;
  if (original instanceof HttpErrorResponse) {
    return !responseIndicatesAuthSessionInvalid(original);
  }
  return true;
}
