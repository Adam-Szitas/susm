import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { FileService } from './file.service';
import { HttpService } from './http.service';
import { NotificationService } from './notification.service';
import { ErrorHandlerService } from './error-handler.service';

describe('Project upload grouping', () => {
  let service: FileService;
  let post: jasmine.Spy;
  beforeEach(() => {
    post = jasmine.createSpy().and.returnValue(of(['photo.jpg']));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        FileService,
        { provide: HttpService, useValue: { post } },
        { provide: NotificationService, useValue: {} },
        { provide: ErrorHandlerService, useValue: {} },
      ],
    });
    service = TestBed.inject(FileService);
  });
  it('sends the same group ID with every photo in a grouped batch', async () => {
    const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
    await firstValueFrom(
      service.uploadFileForProject(new FormData(), 'project', files, {
        groupId: 'batch-id',
        description: 'Site visit',
        note: 'Front entrance',
      }),
    );
    expect(post.calls.count()).toBe(2);
    for (const call of post.calls.all()) {
      const form = call.args[1] as FormData;
      expect(form.get('group_id')).toBe('batch-id');
      expect(form.get('description')).toBe('Site visit');
      expect(form.getAll('avatar').length).toBe(1);
    }
  });
  it('uploads an individual photo without a group ID', async () => {
    await firstValueFrom(
      service.uploadFileForProject(new FormData(), 'project', [new File(['a'], 'a.jpg')]),
    );
    expect((post.calls.mostRecent().args[1] as FormData).has('group_id')).toBeFalse();
  });
  it('creates a named project subgroup with its photos in one request', async () => {
    const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
    await firstValueFrom(
      service.createSubGroupWithUpload(
        'project',
        files,
        { name: 'Visit', categories: ['Outside'], note: 'Front' },
        'project',
      ),
    );
    const call = post.calls.mostRecent().args;
    expect(call[0]).toBe('file/project/project');
    expect((call[1] as FormData).get('name')).toBe('Visit');
    expect((call[1] as FormData).getAll('avatar').length).toBe(2);
    expect((call[1] as FormData).get('note')).toBe('Front');
  });
  it('keeps object subgroup uploads on their existing endpoint', async () => {
    await firstValueFrom(
      service.createSubGroupWithUpload('object-group', [new File(['a'], 'a.jpg')], {
        name: 'Visit',
      }),
    );
    expect(post.calls.mostRecent().args[0]).toBe('file/group/object-group/sub-groups');
  });
});
