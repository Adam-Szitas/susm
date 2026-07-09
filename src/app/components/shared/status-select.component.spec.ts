import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideZonelessChangeDetection } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { StatusSelectComponent } from './status-select.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, StatusSelectComponent],
  template: `<app-status-select id="status" [formControl]="control" />`,
})
class HostComponent {
  readonly control = new FormControl('created');
}

describe('StatusSelectComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, TranslateModule.forRoot()],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the bound form value', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('created');
  });

  it('updates the form control when the user selects a new status', () => {
    const host = fixture.componentInstance;
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;

    select.value = 'in_progress';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(host.control.value).toBe('in_progress');
  });

  it('reflects programmatic control updates', () => {
    const host = fixture.componentInstance;
    host.control.setValue('closed');
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('closed');
  });
});
