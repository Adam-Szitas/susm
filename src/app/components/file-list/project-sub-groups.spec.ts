import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { FileListComponent } from './file-list.component';
import { SubGroupDetailModalComponent } from '../sub-group-detail-modal/sub-group-detail-modal.component';
import { SubGroupUploadModalComponent } from '../sub-group-upload-modal/sub-group-upload-modal.component';
import { FileService } from '@services/file.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { DateFormatService } from '@services/date-format.service';
import { ImageCompressionService } from '@services/image-compression.service';
import { ProjectFile } from '@models';

const photo = (id: string, group_id?: string): ProjectFile => ({
  _id: { $oid: id },
  project_id: { $oid: 'project' },
  group_id,
  path: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  filename: id + '.jpg',
  created_at: '2026-01-01T00:00:00Z',
});

describe('Project sub-group gallery', () => {
  let fixture: ComponentFixture<FileListComponent>;
  let files: jasmine.SpyObj<FileService>;
  beforeEach(async () => {
    files = jasmine.createSpyObj('FileService', ['createSubGroupWithUpload', 'addFilesToSubGroup']);
    files.createSubGroupWithUpload.and.returnValue(of({}));
    files.addFilesToSubGroup.and.returnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [FileListComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: FileService, useValue: files },
        { provide: ModalService, useValue: {} },
        { provide: NotificationService, useValue: { showSuccess: () => {}, showError: () => {} } },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        { provide: DateFormatService, useValue: { formatUtcDate: () => '2026-01-01' } },
        { provide: ImageCompressionService, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FileListComponent);
    spyOn(fixture.componentInstance, 'getImageUrl').and.returnValue(photo('stub').path);
    fixture.componentRef.setInput('projectId', 'project');
    fixture.componentRef.setInput('projectFiles', [photo('root'), photo('inside', 'sg')]);
    fixture.componentRef.setInput('projectSubGroups', [{ id: 'sg', name: 'Site visit' }]);
    fixture.detectChanges();
  });
  it('renders photos and shared subgroup cards in one gallery without group headings', () => {
    const gallery = fixture.nativeElement.querySelector('.file-gallery');
    expect(gallery.children.length).toBe(2);
    expect(gallery.querySelector('.sub-group-item .sub-group-preview-collage')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.project-file-group')).toBeNull();
    expect(fixture.nativeElement.querySelector('.group-header')).toBeNull();
  });
  it('opens the shared detail modal and refreshes its photos while open', () => {
    fixture.nativeElement.querySelector('.sub-group-item').click();
    fixture.detectChanges();
    let detail = fixture.debugElement.query(By.directive(SubGroupDetailModalComponent))
      .componentInstance as SubGroupDetailModalComponent;
    expect(detail.projectId()).toBe('project');
    expect(detail.subGroup()?.name).toBe('Site visit');
    expect(detail.visibleFiles().length).toBe(1);
    fixture.componentRef.setInput('projectFiles', [
      photo('root'),
      photo('inside', 'sg'),
      photo('added', 'sg'),
    ]);
    fixture.detectChanges();
    expect(detail.visibleFiles().length).toBe(2);
  });
  it('opens subgroup creation even when the project has no photos', () => {
    fixture.componentRef.setInput('projectFiles', []);
    fixture.componentRef.setInput('projectSubGroups', []);
    fixture.componentInstance.openProjectSubGroupUploadModal();
    fixture.detectChanges();
    const upload = fixture.debugElement.query(By.directive(SubGroupUploadModalComponent))
      .componentInstance as SubGroupUploadModalComponent;
    expect(upload.isOpen()).toBeTrue();
    expect(upload.addMode()).toBeFalse();
    fixture.componentInstance.onSubGroupUpload({
      name: 'First visit',
      categories: [],
      note: '',
      files: [new File(['a'], 'a.jpg')],
    });
    expect(files.createSubGroupWithUpload.calls.mostRecent().args[3]).toBe('project');
  });
  it('adds photos to the open project subgroup using its saved name', () => {
    fixture.nativeElement.querySelector('.sub-group-item').click();
    fixture.detectChanges();
    fixture.componentInstance.onSubGroupDetailAddPhotos();
    fixture.detectChanges();
    const upload = fixture.debugElement.query(By.directive(SubGroupUploadModalComponent))
      .componentInstance as SubGroupUploadModalComponent;
    expect(upload.addMode()).toBeTrue();
    expect(upload.initialName()).toBe('Site visit');
    fixture.componentInstance.onSubGroupUpload({
      name: 'Site visit',
      categories: [],
      note: '',
      files: [],
    });
    expect(files.addFilesToSubGroup).toHaveBeenCalledWith('sg', [], 'project');
  });
});
