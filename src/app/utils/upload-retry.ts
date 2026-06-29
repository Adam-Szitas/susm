import type { AppError } from '@services/error-handler.service';

const RETRYABLE_STATUS = new Set([0, 408, 429, 502, 503, 504]);

/** Whether a failed upload should be retried (transient network / incomplete body). */
export function isRetryableUploadError(error: unknown): boolean {
  const appError = error as AppError;
  const message = (appError?.message ?? '').toLowerCase();
  if (
    message.includes('incomplete') ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('timeout')
  ) {
    return true;
  }
  const status = appError?.status;
  return status != null && RETRYABLE_STATUS.has(status);
}

export const UPLOAD_MAX_ATTEMPTS = 3;

export function uploadRetryDelayMs(attemptIndex: number): number {
  return 1000 * (attemptIndex + 1);
}
