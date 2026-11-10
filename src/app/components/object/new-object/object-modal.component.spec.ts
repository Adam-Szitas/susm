import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { ObjectModalComponent } from './object-modal.component';

describe('ObjectModalComponent', () => {
  let fixture: ComponentFixture<ObjectModalComponent>;
  let component: ObjectModalComponent;
  let createObjects: jasmine.Spy;

  beforeEach(async () => {
    createObjects = jasmine.createSpy('createObjects').and.returnValue(of([{}]));
    await TestBed.configureTestingModule({
      imports: [ObjectModalComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ProjectStore,
          useValue: {
            project: () => ({ _id: { $oid: 'project-1' } }),
            objects: () => [{ address: { house_number: '12' } }],
            createObjects,
            loadObjects: jasmine.createSpy('loadObjects'),
          },
        },
        { provide: ModalService, useValue: { close: jasmine.createSpy('close') } },
        {
          provide: NotificationService,
          useValue: { showSuccess: jasmine.createSpy(), showError: jasmine.createSpy() },
        },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ObjectModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates one object when the end is omitted, including after clearing the number input', () => {
    component.form.patchValue({ prefix: ' Block A ', rangeStart: 10, rangeEnd: null });
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(createObjects).toHaveBeenCalledOnceWith({
      projectId: { $oid: 'project-1' },
      objects: [
        {
          address: { house_number: '10', level: '', door_number: '' },
          note: '',
          status: component.form.value.status,
          prefix: 'Block A',
        },
      ],
    });
  });

  it('creates an inclusive range and skips existing numbers by default', () => {
    component.form.patchValue({ rangeStart: 10, rangeEnd: 13 });
    component.submit();
    expect(
      createObjects.calls
        .mostRecent()
        .args[0].objects.map(
          (object: { address: { house_number: string } }) => object.address.house_number,
        ),
    ).toEqual(['10', '11', '13']);
  });

  it('allows existing numbers when the switch is turned off', () => {
    component.form.patchValue({ rangeStart: 12 });
    fixture.detectChanges();
    expect(component.getRangePreview().errorKey).toBe('objects.rangeAllSkipped');
    const toggle = fixture.nativeElement.querySelector('[role="switch"]') as HTMLInputElement;
    toggle.click();
    fixture.detectChanges();
    expect(component.getRangePreview().toCreate).toEqual(['12']);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeFalse();
  });

  it('requires a start and rejects fractional numbers and oversized ranges', () => {
    for (const values of [
      { rangeStart: '', rangeEnd: 13 },
      { rangeStart: 1.5, rangeEnd: '' },
      { rangeStart: 1, rangeEnd: 101 },
    ]) {
      component.form.patchValue(values);
      component.submit();
      expect(component.getRangePreview().valid).toBeFalse();
    }
    expect(createObjects).not.toHaveBeenCalled();
  });
});
