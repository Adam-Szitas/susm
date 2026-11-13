import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { Object as ProjectObject, ObjectTodoEntry, TodoItem } from '@models';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { AssignmentNoteEditorModalComponent } from './assignment-note-editor-modal.component';
import { ObjectTodosSectionComponent } from './object-todos-section.component';

describe('object checklist assignment note editor', () => {
  const item: TodoItem = { _id: { $oid: 'check' }, title: 'Door', sort_order: 0 };
  let entries: ObjectTodoEntry[];
  let admin: ReturnType<typeof signal<boolean>>;
  let superuser: ReturnType<typeof signal<boolean>>;
  let update: jasmine.Spy;
  let modal: {
    open: jasmine.Spy;
    close: jasmine.Spy;
    setCloseGuard: jasmine.Spy;
    clearCloseGuard: jasmine.Spy;
  };
  let notifications: { showSuccess: jasmine.Spy; showError: jasmine.Spy };

  beforeEach(() => {
    admin = signal(true);
    superuser = signal(false);
    entries = [
      {
        todo_item_id: 'check',
        todo_sub_item_id: 'option',
        status: 'finished',
        assignment_note: 'Existing note',
        hidden_from_protocol: true,
        external_notes: [
          {
            id: 'visitor',
            author_email: 'visitor@example.com',
            body: 'Comment',
            created_at: '2026-11-13',
          },
        ],
      },
      { todo_item_id: 'other', status: 'under_process', assignment_note: 'Keep me' },
    ];
    update = jasmine.createSpy().and.callFake((_id, next) => of({ todo_entries: next }));
    modal = {
      open: jasmine.createSpy().and.returnValue({}),
      close: jasmine.createSpy(),
      setCloseGuard: jasmine.createSpy(),
      clearCloseGuard: jasmine.createSpy(),
    };
    notifications = { showSuccess: jasmine.createSpy(), showError: jasmine.createSpy() };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProjectStore, useValue: { updateObjectTodos: update } },
        { provide: UserStore, useValue: { isAdmin: admin, isSuperuser: superuser } },
        { provide: ModalService, useValue: modal },
        { provide: NotificationService, useValue: notifications },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  async function editor() {
    const fixture = TestBed.createComponent(AssignmentNoteEditorModalComponent);
    fixture.componentRef.setInput('objectId', 'object');
    fixture.componentRef.setInput('todoItem', item);
    fixture.componentRef.setInput('initialNote', 'Existing note');
    fixture.componentRef.setInput('getEntries', () => entries);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('offers the stacked editor to admins and superusers, including empty notes, but not members', () => {
    const fixture = TestBed.createComponent(ObjectTodosSectionComponent);
    fixture.componentRef.setInput('objectId', 'object');
    fixture.componentRef.setInput('todoItems', [item]);
    fixture.componentRef.setInput('todoEntries', [{ todo_item_id: 'check', status: 'finished' }]);
    fixture.componentInstance.expanded.set(true);
    fixture.detectChanges();
    const editButton = () =>
      fixture.nativeElement.querySelector('.todo-item-controls .todo-assignment-note-edit');
    expect(editButton()).not.toBeNull();
    editButton().click();
    expect(modal.open).toHaveBeenCalledWith(
      jasmine.objectContaining({ stack: true, component: AssignmentNoteEditorModalComponent }),
    );
    admin.set(false);
    fixture.detectChanges();
    expect(editButton()).toBeNull();
    modal.open.calls.reset();
    fixture.componentInstance.editAssignmentNote(item);
    expect(modal.open).not.toHaveBeenCalled();
    superuser.set(true);
    fixture.detectChanges();
    expect(editButton()).not.toBeNull();
  });

  it('prefills the draft and saves only the selected assignment note using the latest entries', async () => {
    const fixture = await editor();
    expect(fixture.componentInstance.draft()).toBe('Existing note');
    entries = [...entries, { todo_item_id: 'new', status: 'under_process' }];
    const saved = jasmine.createSpy();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.draft.set('Updated note');
    fixture.componentInstance.save();
    const expected = entries.map((entry) =>
      entry.todo_item_id === 'check' ? { ...entry, assignment_note: 'Updated note' } : entry,
    );
    expect(update).toHaveBeenCalledOnceWith('object', expected);
    expect(saved).toHaveBeenCalledWith(expected);
    expect(modal.close).toHaveBeenCalled();
    expect(entries[0].assignment_note).toBe('Existing note');
  });

  it('allows clearing a note and rejects over-limit values or member saves', async () => {
    const fixture = await editor();
    fixture.componentInstance.draft.set('x'.repeat(501));
    fixture.componentInstance.save();
    expect(update).not.toHaveBeenCalled();
    admin.set(false);
    fixture.componentInstance.draft.set('New note');
    fixture.componentInstance.save();
    expect(update).not.toHaveBeenCalled();
    admin.set(true);
    fixture.componentInstance.draft.set('');
    fixture.componentInstance.save();
    expect(update.calls.mostRecent().args[1][0].assignment_note).toBeUndefined();
    expect(update.calls.mostRecent().args[1][1]).toEqual(entries[1]);
  });

  it('keeps the draft and editor open on failure and does not save on cancel', async () => {
    update.and.returnValue(throwError(() => new Error('Failure')));
    const fixture = await editor();
    fixture.componentInstance.draft.set('Keep this draft');
    fixture.componentInstance.save();
    expect(fixture.componentInstance.draft()).toBe('Keep this draft');
    expect(fixture.componentInstance.error()).toBe('todos.objectUpdateFailed');
    expect(modal.close).not.toHaveBeenCalled();
    expect(notifications.showError).toHaveBeenCalled();
    update.calls.reset();
    fixture.componentInstance.cancel();
    expect(modal.close).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('prevents duplicate saves and closing while saving, and rejects a removed assignment', async () => {
    const response = new Subject<ProjectObject>();
    update.and.returnValue(response);
    const fixture = await editor();
    fixture.componentInstance.save();
    fixture.componentInstance.save();
    fixture.componentInstance.cancel();
    expect(update).toHaveBeenCalledTimes(1);
    expect(modal.close).not.toHaveBeenCalled();
    expect(modal.setCloseGuard.calls.mostRecent().args[0]()).toBeFalse();
    response.error(new Error('Failure'));
    entries = entries.filter((entry) => entry.todo_item_id !== 'check');
    update.calls.reset();
    fixture.componentInstance.save();
    expect(update).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toBe('todos.assignmentNoteUnassigned');
  });
});
