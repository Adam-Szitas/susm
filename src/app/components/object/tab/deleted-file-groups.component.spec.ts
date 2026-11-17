import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { FileGroup } from '../../../models/file.model';
import { DateFormatService } from '../../../services/date-format.service';
import { FileService } from '../../../services/file.service';
import { NotificationService } from '../../../services/notification.service';
import { TranslationService } from '../../../services/translation.service';
import { UserStore } from '../../../store/user.store';
import { DeletedFileGroupsComponent } from './deleted-file-groups.component';

function group(id: string, description: string, deletedAt?: string, files: object[] = []): FileGroup {
  return {
    _id: { $oid: id },
    description,
    files,
    ...(deletedAt ? { deleted_at: { $date: deletedAt } } : {}),
  } as unknown as FileGroup;
}

describe('DeletedFileGroupsComponent', () => {
  let fixture: ComponentFixture<DeletedFileGroupsComponent>;
  let isAdmin: ReturnType<typeof signal<boolean>>;
  let trashEnabled: ReturnType<typeof signal<boolean>>;
  let restoreFileGroup: jasmine.Spy;
  let getRemovedFileGroupsForObject: jasmine.Spy;
  let showSuccess: jasmine.Spy;
  let showError: jasmine.Spy;

  const groups = [
    group('active', 'Kitchen'),
    group('older', 'Hall', '2026-01-01T10:00:00Z', [
      { _id: { $oid: 'f1' } },
      { _id: { $oid: 'f2' }, deleted_at: '2026-01-01T09:00:00Z' },
    ]),
    group('newer', 'Roof', '2026-02-01T10:00:00Z'),
  ];

  const names = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.deleted-file-group-name')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );

  const toggle = () =>
    fixture.nativeElement.querySelector('.deleted-toggle input') as HTMLInputElement | null;
  const switchOn = () => {
    const input = toggle()!;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    isAdmin = signal(true);
    trashEnabled = signal(true);
    restoreFileGroup = jasmine.createSpy('restoreFileGroup').and.returnValue(of({ message: 'ok' }));
    getRemovedFileGroupsForObject = jasmine
      .createSpy('getRemovedFileGroupsForObject')
      .and.returnValue(of(groups));
    showSuccess = jasmine.createSpy('showSuccess');
    showError = jasmine.createSpy('showError');
    TestBed.configureTestingModule({
      imports: [DeletedFileGroupsComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: UserStore, useValue: { isAdmin, trashEnabled } },
        { provide: FileService, useValue: { restoreFileGroup, getRemovedFileGroupsForObject } },
        { provide: NotificationService, useValue: { showSuccess, showError } },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        { provide: DateFormatService, useValue: { formatDateTime: () => 'date' } },
      ],
    });
    fixture = TestBed.createComponent(DeletedFileGroupsComponent);
    fixture.componentRef.setInput('objectId', 'obj1');
    fixture.detectChanges();
  });

  it('shows a switch with the count; the list appears only when switched on', () => {
    expect(toggle()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.deleted-file-groups-count').textContent.trim()).toBe('2');
    expect(fixture.nativeElement.querySelector('.deleted-file-groups')).toBeNull();
    switchOn();
    expect(fixture.nativeElement.querySelector('.deleted-file-groups')).not.toBeNull();
  });

  it('lists only removed groups, most recently removed first, counting active photos', () => {
    switchOn();
    expect(names()).toEqual(['Roof', 'Hall']);
    const hall = fixture.componentInstance.rows().find((row) => row.id === 'older')!;
    expect(hall.photoCount).toBe(1);
  });

  it('loads removed groups for the object and reloads when asked', () => {
    expect(getRemovedFileGroupsForObject).toHaveBeenCalledWith('obj1');
    fixture.componentRef.setInput('reloadKey', 1);
    fixture.detectChanges();
    expect(getRemovedFileGroupsForObject).toHaveBeenCalledTimes(2);
  });

  it('is hidden and does not load for non-admins or when the trash feature is off', () => {
    getRemovedFileGroupsForObject.calls.reset();
    isAdmin.set(false);
    fixture.detectChanges();
    expect(toggle()).toBeNull();
    expect(fixture.nativeElement.querySelector('.deleted-file-groups')).toBeNull();

    isAdmin.set(true);
    trashEnabled.set(false);
    fixture.detectChanges();
    expect(toggle()).toBeNull();
    expect(getRemovedFileGroupsForObject).not.toHaveBeenCalled();
  });

  it('keeps the switch visible and says so when no group is removed', () => {
    getRemovedFileGroupsForObject.and.returnValue(of([]));
    fixture.componentRef.setInput('reloadKey', 1);
    fixture.detectChanges();
    expect(toggle()).not.toBeNull();
    switchOn();
    expect(fixture.nativeElement.querySelector('.deleted-file-groups-empty')).not.toBeNull();
  });

  it('restores a group and asks the parent to reload', () => {
    const restored = jasmine.createSpy('restored');
    fixture.componentInstance.restored.subscribe(restored);
    switchOn();
    const button = fixture.nativeElement.querySelector('.deleted-file-group button') as HTMLButtonElement;
    button.click();
    expect(restoreFileGroup).toHaveBeenCalledWith('newer');
    expect(showSuccess).toHaveBeenCalled();
    expect(restored).toHaveBeenCalled();
    fixture.detectChanges();
    expect(names()).toEqual(['Hall']);
  });

  it('reports a failed restore without reloading', () => {
    restoreFileGroup.and.returnValue(throwError(() => new Error('Forbidden')));
    const restored = jasmine.createSpy('restored');
    fixture.componentInstance.restored.subscribe(restored);
    fixture.componentInstance.restore(fixture.componentInstance.rows()[0]);
    expect(showError).toHaveBeenCalledWith('Forbidden');
    expect(restored).not.toHaveBeenCalled();
    expect(fixture.componentInstance.restoringIds().size).toBe(0);
  });
});
