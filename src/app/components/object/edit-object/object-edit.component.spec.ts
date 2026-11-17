import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import type { Object } from '@models';
import { HttpService } from '@services/http.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { EditObjectComponent } from './object-edit.component';

const object = {
  _id: { $oid: 'obj-1' },
  address: { house_number: '3' },
  note: '',
  status: 'created',
} as unknown as Object;

describe('EditObjectComponent delete', () => {
  let fixture: ComponentFixture<EditObjectComponent>;
  let deleteObject: jasmine.Spy;
  let navigate: jasmine.Spy;
  let openConfirm: jasmine.Spy;

  beforeEach(() => {
    deleteObject = jasmine.createSpy('deleteObject').and.returnValue(of({ message: 'ok' }));
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    openConfirm = jasmine.createSpy('openConfirm').and.resolveTo(true);
    TestBed.configureTestingModule({
      imports: [EditObjectComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProjectStore, useValue: { deleteObject } },
        { provide: Router, useValue: { navigate } },
        { provide: ModalService, useValue: { openConfirm, close: () => undefined } },
        {
          provide: NotificationService,
          useValue: { showSuccess: () => undefined, showError: () => undefined },
        },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        { provide: UserStore, useValue: { isAdmin: signal(true) } },
        { provide: HttpService, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(EditObjectComponent);
    fixture.componentInstance.objectData = object;
  });

  it("redirects to the object's project tab after removal", async () => {
    fixture.componentInstance.projectId = 'proj-9';
    await fixture.componentInstance.deleteObject();
    expect(deleteObject).toHaveBeenCalledWith('obj-1');
    expect(navigate).toHaveBeenCalledWith(['/projects/tab', 'proj-9']);
  });

  it('falls back to the objects list when the project is unknown', async () => {
    fixture.componentInstance.projectId = null;
    await fixture.componentInstance.deleteObject();
    expect(navigate).toHaveBeenCalledWith(['/objects']);
  });

  it('stays on the page when the removal is cancelled or fails', async () => {
    fixture.componentInstance.projectId = 'proj-9';
    openConfirm.and.resolveTo(false);
    await fixture.componentInstance.deleteObject();
    expect(deleteObject).not.toHaveBeenCalled();

    openConfirm.and.resolveTo(true);
    deleteObject.and.returnValue(throwError(() => new Error('nope')));
    await fixture.componentInstance.deleteObject();
    expect(navigate).not.toHaveBeenCalled();
  });
});
