import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ProjectStore } from './project.store';
import { HttpService } from '@services/http.service';
import { ObjectWithProject } from '@models';

describe('project store deleted objects', () => {
  const active: ObjectWithProject = {
    project_name: 'River street',
    object: {
      _id: { $oid: 'active' },
      address: { house_number: '1' },
      note: 'Active',
    },
  };
  const removed: ObjectWithProject = {
    project_name: 'River street',
    object: {
      _id: { $oid: 'removed' },
      address: { house_number: '2' },
      note: 'Removed',
      deleted_at: '2026-11-16T10:00:00.000Z',
    },
  };

  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }),
  );

  it('requests deleted objects only when the deleted list is on', () => {
    const http = {
      get: jasmine.createSpy().and.returnValue(of([removed])),
    };
    TestBed.configureTestingModule({ providers: [{ provide: HttpService, useValue: http }] });
    const store = TestBed.inject(ProjectStore);

    store.loadAllObjects(true);

    expect(http.get).toHaveBeenCalledOnceWith('objects', { deleted: 'true' });
    expect(store.allObjectsDeleted()).toBeTrue();
    expect(store.objectsWithProjects()).toEqual([removed]);
    expect(store.allObjectsLoading()).toBeFalse();
  });

  it('keeps the active list request unchanged', () => {
    const http = {
      get: jasmine.createSpy().and.returnValue(of([active])),
    };
    TestBed.configureTestingModule({ providers: [{ provide: HttpService, useValue: http }] });
    const store = TestBed.inject(ProjectStore);

    store.loadAllObjects();

    expect(http.get).toHaveBeenCalledOnceWith('objects', undefined);
    expect(store.allObjectsDeleted()).toBeFalse();
    expect(store.objectsWithProjects()).toEqual([active]);
  });

  it('ignores a stale objects response after the deleted toggle changes', () => {
    const activeRequest = new Subject<ObjectWithProject[]>();
    const deletedRequest = new Subject<ObjectWithProject[]>();
    const http = {
      get: jasmine.createSpy().and.returnValues(activeRequest, deletedRequest),
    };
    TestBed.configureTestingModule({ providers: [{ provide: HttpService, useValue: http }] });
    const store = TestBed.inject(ProjectStore);

    store.loadAllObjects(false);
    store.loadAllObjects(true);
    deletedRequest.next([removed]);
    activeRequest.next([active]);

    expect(store.objectsWithProjects()).toEqual([removed]);
    expect(store.allObjectsDeleted()).toBeTrue();
  });

  it('drops a restored object from the deleted list', () => {
    const http = {
      get: jasmine.createSpy().and.returnValue(of([removed])),
      post: jasmine.createSpy().and.returnValue(of({ message: 'Object restored successfully' })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: HttpService, useValue: http }] });
    const store = TestBed.inject(ProjectStore);
    store.loadAllObjects(true);

    store.restoreObject('removed').subscribe();

    expect(http.post).toHaveBeenCalledOnceWith('object/removed/restore', {}, undefined, {
      suppressErrorNotification: true,
    });
    expect(store.objectsWithProjects()).toEqual([]);
  });

  it('leaves the active list in place when restore runs outside the deleted view', () => {
    const http = {
      get: jasmine.createSpy().and.returnValue(of([active])),
      post: jasmine.createSpy().and.returnValue(of({ message: 'Object restored successfully' })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: HttpService, useValue: http }] });
    const store = TestBed.inject(ProjectStore);
    store.loadAllObjects(false);

    store.restoreObject('active').subscribe();

    expect(store.objectsWithProjects()).toEqual([active]);
  });

  it('records a load error and clears the list for that mode', () => {
    const http = {
      get: jasmine.createSpy().and.returnValue(throwError(() => ({ message: 'nope' }))),
    };
    TestBed.configureTestingModule({ providers: [{ provide: HttpService, useValue: http }] });
    const store = TestBed.inject(ProjectStore);

    store.loadAllObjects(true);

    expect(store.allObjectsError()).toBe('nope');
    expect(store.objectsWithProjects()).toEqual([]);
    expect(store.allObjectsDeleted()).toBeTrue();
    expect(store.allObjectsLoading()).toBeFalse();
  });
});
