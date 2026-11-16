import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ObjectWithProject } from '@models';
import { ProjectStore } from '@store/project.store';
import { NotificationService } from '@services/notification.service';
import { FilterPersistenceService } from '@services/filter-persistence.service';
import { ObjectCardComponent } from '../shared/object-card.component';
import { ObjectComponent } from './objects.component';

@Component({
  selector: 'app-object-card',
  standalone: true,
  template: '',
})
class ObjectCardStub {
  readonly object = input.required<ObjectWithProject['object']>();
  readonly projectName = input<string | null>(null);
  readonly routerLink = input<string | string[] | null>(null);
  readonly showStatus = input(false);
  readonly includePostalCode = input(false);
  readonly showRemovedAt = input(false);
  readonly dateFormat = input<'date' | 'datetime'>('date');
}

describe('ObjectComponent deleted objects', () => {
  const removed: ObjectWithProject = {
    project_name: 'River street',
    object: {
      _id: { $oid: 'removed' },
      address: { house_number: '12' },
      note: 'Gone',
      deleted_at: '2026-11-16T12:00:00.000Z',
    },
  };

  let objects: ReturnType<typeof signal<ObjectWithProject[]>>;
  let loading: ReturnType<typeof signal<boolean>>;
  let loadError: ReturnType<typeof signal<string | null>>;
  let loadAllObjects: jasmine.Spy;
  let restoreObject: jasmine.Spy;
  let showSuccess: jasmine.Spy;
  let fixture: ComponentFixture<ObjectComponent>;

  beforeEach(async () => {
    objects = signal<ObjectWithProject[]>([]);
    loading = signal(false);
    loadError = signal<string | null>(null);
    loadAllObjects = jasmine.createSpy('loadAllObjects');
    showSuccess = jasmine.createSpy('showSuccess');
    restoreObject = jasmine.createSpy('restoreObject').and.callFake((objectId: string) => {
      objects.update((rows) => rows.filter((item) => item.object._id?.$oid !== objectId));
      return of({ message: 'ok' });
    });
    sessionStorage.clear();

    TestBed.overrideComponent(ObjectComponent, {
      remove: { imports: [ObjectCardComponent] },
      add: { imports: [ObjectCardStub] },
    });

    await TestBed.configureTestingModule({
      imports: [ObjectComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ProjectStore,
          useValue: {
            objectsWithProjects: objects.asReadonly(),
            allObjectsLoading: loading.asReadonly(),
            allObjectsError: loadError.asReadonly(),
            loadAllObjects,
            restoreObject,
          },
        },
        {
          provide: FilterPersistenceService,
          useValue: { restore: () => null, save: jasmine.createSpy('save') },
        },
        {
          provide: NotificationService,
          useValue: {
            showSuccess,
            showError: jasmine.createSpy('showError'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectComponent);
    fixture.detectChanges();
  });

  it('loads active objects on startup and deleted objects when the switch is turned on', () => {
    expect(loadAllObjects).toHaveBeenCalledOnceWith(false);

    const input = fixture.nativeElement.querySelector(
      '.deleted-toggle input',
    ) as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(loadAllObjects).toHaveBeenCalledWith(true);
    expect(fixture.componentInstance.showDeleted()).toBeTrue();
    expect(fixture.nativeElement.querySelector('#deleted-objects-hint')).not.toBeNull();
  });

  it('offers restore for each deleted object and removes it from that list', () => {
    objects.set([removed]);
    fixture.componentInstance.onShowDeletedChange(true);
    loading.set(false);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.restore-button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    fixture.detectChanges();

    expect(restoreObject).toHaveBeenCalledOnceWith('removed');
    expect(showSuccess).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.restore-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.empty-state')).not.toBeNull();
  });
});
