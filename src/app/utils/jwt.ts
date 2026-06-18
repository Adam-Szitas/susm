export interface JwtPayload {
  sub?: string;
  exp?: number;
}

/** Renew when this many milliseconds remain before `exp`. */
export const SESSION_RENEW_BEFORE_MS = 5 * 60 * 1000;

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenExpiresAtMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return null;
  }
  return payload.exp * 1000;
}

export function shouldRenewTokenNow(token: string, nowMs = Date.now()): boolean {
  const expiresAt = getTokenExpiresAtMs(token);
  if (!expiresAt) {
    return false;
  }
  return expiresAt - nowMs <= SESSION_RENEW_BEFORE_MS;
}

export function msUntilTokenRenewal(token: string, nowMs = Date.now()): number | null {
  const expiresAt = getTokenExpiresAtMs(token);
  if (!expiresAt) {
    return null;
  }
  return Math.max(expiresAt - SESSION_RENEW_BEFORE_MS - nowMs, 0);
}
