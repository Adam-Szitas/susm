import { localFeatures } from './features.local';

/** App feature flags (sourced from `features.local.ts`). */
export const features = {
  ...localFeatures,
} as const;
