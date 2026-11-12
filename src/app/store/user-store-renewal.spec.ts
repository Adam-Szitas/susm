import { shouldLogoutAfterRenewFailure } from './user.store';

function tokenExpiringAt(ms: number): string {
  const payload = btoa(JSON.stringify({ sub: 'a@b.co', exp: Math.floor(ms / 1000) }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `e30.${payload}.sig`;
}

describe('session renewal failure handling', () => {
  const now = Date.UTC(2026, 0, 1);
  const valid = tokenExpiringAt(now + 60 * 60 * 1000);

  it('keeps the session on network errors and server hiccups', () => {
    expect(shouldLogoutAfterRenewFailure({ status: 0 }, valid, now)).toBeFalse();
    expect(shouldLogoutAfterRenewFailure({ status: 502 }, valid, now)).toBeFalse();
    expect(shouldLogoutAfterRenewFailure(new Error('offline'), valid, now)).toBeFalse();
  });

  it('logs out when the server rejects the session', () => {
    expect(shouldLogoutAfterRenewFailure({ status: 401 }, valid, now)).toBeTrue();
    expect(shouldLogoutAfterRenewFailure({ status: 403 }, valid, now)).toBeTrue();
  });

  it('logs out when the token has already expired, whatever the error', () => {
    expect(shouldLogoutAfterRenewFailure({ status: 0 }, tokenExpiringAt(now - 1000), now)).toBeTrue();
  });
});
