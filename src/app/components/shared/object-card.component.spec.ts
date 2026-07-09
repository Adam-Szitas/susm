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
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
      ],
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

  it('hides note in compact mode', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.note')).toBeNull();
    expect(fixture.nativeElement.querySelector('.headline-text')?.textContent?.trim()).toBe('12');
  });
});
