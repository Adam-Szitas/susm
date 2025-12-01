export const WORK_STATUSES = ['created', 'in_progress', 'rejected', 'verified', 'closed'] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const DEFAULT_WORK_STATUS: WorkStatus = 'created';

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  created: 'Created',
  in_progress: 'In progress',
  rejected: 'Rejected',
  verified: 'Verified',
  closed: 'Closed',
};

export const formatWorkStatus = (status?: WorkStatus | null): string =>
  WORK_STATUS_LABELS[status ?? DEFAULT_WORK_STATUS];

