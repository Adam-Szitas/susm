import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppInstallService } from './app-install.service';

describe('AppInstallService', () => {
  const key = 'susm-install-dismissed';
  let previous: string | null;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    previous = localStorage.getItem(key);
    localStorage.removeItem(key);
  });
  afterEach(() => {
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
  });

  it('keeps installation available from the menu after banner dismissal and consumes the prompt once', async () => {
    const install = TestBed.inject(AppInstallService);
    const prompt = jasmine.createSpy('prompt').and.resolveTo();
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt });
    window.dispatchEvent(event);
    install.dismiss();
    expect(event.defaultPrevented).toBeTrue();
    expect(install.available()).toBeTrue();
    expect(localStorage.getItem(key)).toBe('1');
    await install.install();
    expect(prompt).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('appinstalled'));
    expect(install.available()).toBeFalse();
  });
});
