import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ObjectCardComponent } from './object-card.component';
import type { Object } from '@models';

const mockObject = {
  _id: { $oid: 'obj-1' },
  status: 'created',
  address: { house_number: '12', level: '2', door_number: 'A' },
  category: 'A',
  note: 'Test note',
  created_at: '2026-01-01T00:00:00.000Z',
} as Object;

describe('ObjectCardComponent', () => {
  let fixture: ComponentFixture<ObjectCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectCardComponent, TranslateModule.forRoot()],
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectCardComponent);
    fixture.componentRef.setInput('object', mockObject);
    fixture.detectChanges();
  });

  it('renders the formatted address headline', () => {
    const headline = fixture.nativeElement.querySelector('.headline-text') as HTMLElement;
    expect(headline.textContent?.trim()).toBe('12, 2, A');
  });

  it('shows status pill when showStatus is enabled', () => {
    fixture.componentRef.setInput('showStatus', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-status-pill')).not.toBeNull();
  });

  it('shows the prefix before the address with the date underneath', () => {
    fixture.componentRef.setInput('object', { ...mockObject, prefix: 'Block A' });
    fixture.detectChanges();

    const headline = fixture.nativeElement.querySelector('.headline') as HTMLElement;
    const date = fixture.nativeElement.querySelector('.created-at') as HTMLElement;
    expect(headline.textContent?.trim()).toBe('Block A 12, 2, A');
    expect(headline.title).toBe('Block A 12, 2, A');
    expect(date.textContent).toContain('2026');
    expect(headline.nextElementSibling).toBe(date);
  });

  it('shows the prefix in compact mode without repeating a legacy house number suffix', () => {
    fixture.componentRef.setInput('object', { ...mockObject, prefix: 'Block A 12' });
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.headline-text')?.textContent?.trim()).toBe(
      'Block A 12',
    );
  });

  it('hides note in compact mode', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.note')).toBeNull();
    expect(fixture.nativeElement.querySelector('.headline-text')?.textContent?.trim()).toBe('12');
  });
});
