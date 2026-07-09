import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { IconComponent } from './icon.component';
import { icons } from './icon.definitions';

describe('IconComponent', () => {
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'plus');
    fixture.detectChanges();
  });

  it('renders by registry name', () => {
    const path = fixture.nativeElement.querySelector('path');
    expect(path?.getAttribute('d')).toContain('M12 5');
  });

  it('renders by icon constant', () => {
    fixture.componentRef.setInput('name', null);
    fixture.componentRef.setInput('icon', icons.archive);
    fixture.detectChanges();

    const rect = fixture.nativeElement.querySelector('rect');
    expect(rect).not.toBeNull();
  });
});
