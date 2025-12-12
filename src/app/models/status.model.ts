export const WORK_STATUSES = ['created', 'in_progress', 'rejected', 'verified', 'closed'] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const DEFAULT_WORK_STATUS: WorkStatus = 'created';

// Translation keys for work statuses
export const WORK_STATUS_TRANSLATION_KEYS: Record<WorkStatus, string> = {
  created: 'status.created',
  in_progress: 'status.in_progress',
  rejected: 'status.rejected',
  verified: 'status.verified',
  closed: 'status.closed',
};

// Returns the translation key for a given status
export const getStatusTranslationKey = (status?: WorkStatus | null): string =>
  WORK_STATUS_TRANSLATION_KEYS[status ?? DEFAULT_WORK_STATUS];

// Legacy function for backwards compatibility - now returns translation key
export const formatWorkStatus = (status?: WorkStatus | null): string =>
  getStatusTranslationKey(status);

