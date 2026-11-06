import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ImageCompressionService } from '@services/image-compression.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { FileUploadModalComponent } from './file-upload-modal.component';

describe('FileUploadModalComponent photo drops', () => {
  let fixture: ComponentFixture<FileUploadModalComponent>;
  let component: FileUploadModalComponent;
  let compression: jasmine.Spy;
  const photo = () => new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
  const drop = (files: File[]) => {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    return new DragEvent('drop', { dataTransfer, cancelable: true, bubbles: true });
  };

  beforeEach(async () => {
    compression = jasmine.createSpy().and.callFake(async (files: File[]) => files);
    await TestBed.configureTestingModule({
      imports: [FileUploadModalComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ImageCompressionService, useValue: {
          isImageFile: (file: File) => file.type.startsWith('image/'),
          compressImages: compression,
        } },
        { provide: NotificationService, useValue: { showError: jasmine.createSpy() } },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FileUploadModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('accepts a photo drop and filters non-images', async () => {
    const event = drop([photo(), new File(['text'], 'readme.txt', { type: 'text/plain' })]);
    await component.onDrop(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(component.filePreviews().length).toBe(1);
    expect(compression.calls.mostRecent().args[0].length).toBe(1);
    expect(component.filePreviews()[0].previewUrl).toContain('data:image/jpeg');
  });

  it('keeps both overlapping photo selections', async () => {
    await Promise.all([component.onDrop(drop([photo()])), component.onDrop(drop([photo()]))]);
    expect(component.filePreviews().length).toBe(2);
    expect(component.compressing()).toBeFalse();
  });

  it('does not restore pending photos after cancel', async () => {
    let finish!: (files: File[]) => void;
    compression.and.returnValue(new Promise<File[]>(resolve => { finish = resolve; }));
    const pending = component.onDrop(drop([photo()]));
    component.onCancel();
    finish([photo()]);
    await pending;
    expect(component.filePreviews()).toEqual([]);
  });

  it('ignores drops while uploading', async () => {
    fixture.componentRef.setInput('uploading', true);
    await component.onDrop(drop([photo()]));
    expect(compression).not.toHaveBeenCalled();
  });

  it('prevents file navigation when dragging over the modal', () => {
    const event = drop([photo()]);
    const dragover = new DragEvent('dragover', { dataTransfer: event.dataTransfer, cancelable: true, bubbles: true });
    fixture.nativeElement.querySelector('.modal-content').dispatchEvent(dragover);
    expect(dragover.defaultPrevented).toBeTrue();
    expect(component.dragging()).toBeTrue();
  });
});
