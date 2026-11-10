import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { ModalService } from '../../services/modal.service';
import { FileService } from '../../services/file.service';
import { HttpService } from '../../services/http.service';
import { NotificationService } from '../../services/notification.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import {
  MoveFileDestination,
  MoveFileTargetRow,
  MoveFileToGroupModalComponent,
} from './move-file-to-group-modal.component';

const ROWS: MoveFileTargetRow[] = [
  { groupId: 'g1', label: 'Current (group root)', includeGroupRoot: true },
  { groupId: 'g1', label: 'Current', subGroups: [{ subGroupId: 's1', label: 'Visit 1' }] },
  {
    groupId: 'g2',
    label: 'Facade',
    includeGroupRoot: true,
    subGroups: [{ subGroupId: 's2', label: 'North' }],
  },
];

describe('MoveFileToGroupModalComponent', () => {
  let fixture: ComponentFixture<MoveFileToGroupModalComponent>;
  let close: jasmine.Spy;

  const options = () =>
    Array.from(
      fixture.nativeElement.querySelectorAll('.move-file-modal-option'),
    ) as HTMLButtonElement[];
  const optionByLabel = (label: string) =>
    options().find((b) => b.textContent?.trim().startsWith(label))!;

  beforeEach(() => {
    close = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      imports: [MoveFileToGroupModalComponent, TranslateModule.forRoot()],
      providers: [provideZonelessChangeDetection(), { provide: ModalService, useValue: { close } }],
    });
    fixture = TestBed.createComponent(MoveFileToGroupModalComponent);
    fixture.componentRef.setInput('targetRows', ROWS);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
  });

  // The global `li` rule in styles/_lists.scss (loaded by the test builder) must not leak in.
  it('renders every destination as a full-width, aligned option', () => {
    expect(options().map((b) => b.textContent?.trim())).toEqual([
      'Current (group root)',
      'Visit 1',
      'Facade',
      'North',
    ]);
    expect(fixture.nativeElement.querySelector('.move-file-modal-group-label').textContent.trim()).toBe(
      'Current',
    );
    expect(optionByLabel('Facade').classList).toContain('move-file-modal-option--root');

    const listWidth = fixture.nativeElement.querySelector('.move-file-modal-list').getBoundingClientRect();
    const first = optionByLabel('Current (group root)').getBoundingClientRect();
    expect(first.left).toBe(listWidth.left);
    expect(first.width).toBe(listWidth.width);

    for (const row of fixture.nativeElement.querySelectorAll('.move-file-modal-row')) {
      const style = getComputedStyle(row);
      expect(style.marginLeft).toBe('0px');
      expect(style.whiteSpace).toBe('normal');
    }
  });

  it('keeps the modal open and shows the server error when the move fails', () => {
    const submit = jasmine
      .createSpy('submit')
      .and.returnValue(throwError(() => ({ message: 'Target group not found' })));
    fixture.componentRef.setInput('submit', submit);
    fixture.detectChanges();

    optionByLabel('North').click();
    fixture.detectChanges();

    expect(submit).toHaveBeenCalledOnceWith({ groupId: 'g2', subGroupId: 's2' });
    expect(close).not.toHaveBeenCalled();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert.textContent.trim()).toBe('Target group not found');
    expect(options().every((b) => !b.hasAttribute('aria-disabled'))).toBeTrue();
  });

  it('falls back to the translated message when the error has none', () => {
    fixture.componentRef.setInput('submit', () => throwError(() => ({})));
    fixture.detectChanges();
    optionByLabel('Facade').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent.trim()).toBe(
      'fileList.moveFailed',
    );
  });

  it('closes and emits only after the move succeeds, ignoring clicks while pending', () => {
    const response = new Subject<unknown>();
    const submit = jasmine.createSpy('submit').and.returnValue(response);
    const picked: MoveFileDestination[] = [];
    fixture.componentInstance.destinationPicked.subscribe((d) => picked.push(d));
    fixture.componentRef.setInput('submit', submit);
    fixture.detectChanges();

    optionByLabel('Facade').click();
    optionByLabel('North').click();
    fixture.detectChanges();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(optionByLabel('Facade').classList).toContain('move-file-modal-option--pending');
    expect(optionByLabel('North').getAttribute('aria-disabled')).toBe('true');
    expect(close).not.toHaveBeenCalled();

    response.next({ message: 'File moved successfully' });
    expect(picked).toEqual([{ groupId: 'g2', subGroupId: undefined }]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not close another modal when the request finishes after this one was dismissed', () => {
    const response = new Subject<unknown>();
    fixture.componentRef.setInput('submit', () => response);
    fixture.detectChanges();
    optionByLabel('Facade').click();
    fixture.destroy();
    response.next({});
    expect(close).not.toHaveBeenCalled();
  });

  it('emits and closes immediately when no submit handler is provided', () => {
    const picked: MoveFileDestination[] = [];
    fixture.componentInstance.destinationPicked.subscribe((d) => picked.push(d));
    optionByLabel('Visit 1').click();
    expect(picked).toEqual([{ groupId: 'g1', subGroupId: 's1' }]);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('FileService move payloads', () => {
  let service: FileService;
  let post: jasmine.Spy;

  beforeEach(() => {
    post = jasmine.createSpy('post').and.returnValue(of({ message: 'ok' }));
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

  it('posts hex-string ids to /file/{id}/move and omits an empty sub-group', () => {
    service.moveFileToGroup('aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb', null).subscribe();
    expect(post).toHaveBeenCalledOnceWith(
      'file/aaaaaaaaaaaaaaaaaaaaaaaa/move',
      { target_group_id: 'bbbbbbbbbbbbbbbbbbbbbbbb' },
      undefined,
      undefined,
    );
  });

  it('sends the target sub-group and lets the modal own error feedback', () => {
    service
      .moveFileToGroup('f1', 'g2', 's2', { suppressErrorNotification: true })
      .subscribe();
    expect(post).toHaveBeenCalledOnceWith(
      'file/f1/move',
      { target_group_id: 'g2', target_sub_group_id: 's2' },
      undefined,
      { suppressErrorNotification: true },
    );
  });

  it('moves a project photo to the root with an explicit null sub-group', () => {
    service.moveProjectPhoto('p1', 'f1', undefined, { suppressErrorNotification: true }).subscribe();
    expect(post).toHaveBeenCalledOnceWith(
      'file/project/p1/photos/f1/move',
      { sub_group_id: null },
      undefined,
      { suppressErrorNotification: true },
    );
  });
});
