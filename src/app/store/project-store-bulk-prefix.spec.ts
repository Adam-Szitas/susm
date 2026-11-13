import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ProjectStore, BulkObjectPrefixResult } from './project.store';
import { HttpService } from '@services/http.service';
import { Object as ProjectObject, Project } from '@models';

describe('project store bulk prefix patches', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }),
  );
  const first: ProjectObject = {
    _id: { $oid: '1' },
    address: { house_number: '12' },
    prefix: 'Old',
    note: 'Keep',
    todo_entries: [{ todo_item_id: 'check', status: 'finished', assignment_note: 'Local' }],
  };
  const other: ProjectObject = {
    _id: { $oid: '2' },
    address: { house_number: '14' },
    note: 'Other',
  };
  const initial: Project = { _id: { $oid: 'project' }, name: 'Project', objects: [first, other] };
  it('patches returned IDs immutably in every cache and preserves concurrent local changes', () => {
    const result = new Subject<BulkObjectPrefixResult>();
    const http = {
      put: jasmine.createSpy().and.returnValue(result),
      get: jasmine.createSpy().and.callFake((path: string) => {
        if (path === 'projects') return of([initial]);
        if (path === 'objects')
          return of([
            { project_name: 'Project', object: first },
            { project_name: 'Project', object: other },
          ]);
        return of([first, other]);
      }),
    };
    TestBed.configureTestingModule({ providers: [{ provide: HttpService, useValue: http }] });
    const store = TestBed.inject(ProjectStore);
    store.setProject(initial);
    store.loadObjects();
    store.loadProjects();
    store.loadAllObjects();
    store.updateObjectPrefixes('project', ['1'], 'New').subscribe();
    store.setProject({ ...initial, objects: [{ ...first, note: 'Changed while saving' }, other] });
    result.next({ object_ids: ['1'], prefix: 'New' });
    expect(http.put).toHaveBeenCalledOnceWith('project/project/objects/prefix', {
      object_ids: ['1'],
      prefix: 'New',
    });
    expect(store.project()!.objects![0]).toEqual({
      ...first,
      note: 'Changed while saving',
      prefix: 'New',
    });
    expect(store.project()!.objects![1]).toBe(other);
    expect(store.objects()[0].prefix).toBe('New');
    expect(store.projects()[0].objects![0].prefix).toBe('New');
    expect(store.objectsWithProjects()[0].object.prefix).toBe('New');
    expect(first.prefix).toBe('Old');
  });
  it('does not patch caches when the server rejects the batch', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: HttpService,
          useValue: {
            put: () => throwError(() => new Error('Failed')),
          },
        },
      ],
    });
    const store = TestBed.inject(ProjectStore);
    store.setProject(initial);
    store.updateObjectPrefixes('project', ['1'], 'New').subscribe({ error: jasmine.createSpy() });
    expect(store.project()).toBe(initial);
  });
});
