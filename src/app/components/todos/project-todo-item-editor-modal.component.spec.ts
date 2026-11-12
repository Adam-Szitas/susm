import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { Project, TodoItem } from '@models';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectTodoItemEditorModalComponent } from './project-todo-item-editor-modal.component';
import { ProjectTodoAssignToChecklistsPanelComponent } from './project-todo-assign-to-checklists-panel.component';

describe('checklist editing and deletion', () => {
  const target: TodoItem = { _id: { $oid: 'remove' }, title: 'Repair door', sort_order: 0 };
  const keep: TodoItem = {
    _id: { $oid: 'keep' },
    title: 'Keep this checklist',
    note: 'Keep this note',
    sort_order: 1,
  };
  let project: ReturnType<typeof signal<Project | null>>;
  let update: jasmine.Spy;
  let modal: {
    openConfirm: jasmine.Spy;
    close: jasmine.Spy;
    setCloseGuard: jasmine.Spy;
    clearCloseGuard: jasmine.Spy;
  };
  let notifications: { showSuccess: jasmine.Spy; showError: jasmine.Spy };

  beforeEach(() => {
    project = signal<Project | null>({
      _id: { $oid: 'project' },
      name: 'Project',
      todo_items: [target, keep],
    });
    update = jasmine.createSpy().and.returnValue(of({ ...project(), todo_items: [keep] }));
    modal = {
      openConfirm: jasmine.createSpy().and.resolveTo(true),
      close: jasmine.createSpy(),
      setCloseGuard: jasmine.createSpy(),
      clearCloseGuard: jasmine.createSpy(),
    };
    notifications = { showSuccess: jasmine.createSpy(), showError: jasmine.createSpy() };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProjectStore, useValue: { project, updateProjectTodoItems: update } },
        { provide: ModalService, useValue: modal },
        { provide: NotificationService, useValue: notifications },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        { provide: UserStore, useValue: { externalSharingEnabled: () => false } },
      ],
    });
  });

  function editor(item: TodoItem | null = target) {
    const fixture = TestBed.createComponent(ProjectTodoItemEditorModalComponent);
    fixture.componentRef.setInput('projectId', 'project');
    fixture.componentRef.setInput('todoItem', item);
    fixture.componentRef.setInput('existingItems', [target, keep]);
    fixture.detectChanges();
    return fixture;
  }

  it('deletes through the edit dialog after confirmation and preserves the latest other checklists', async () => {
    const added: TodoItem = { _id: { $oid: 'new' }, title: 'Added while editing', sort_order: 2 };
    const fixture = editor();
    project.set({ ...project()!, todo_items: [target, keep, added] });
    (fixture.nativeElement.querySelector('.checklist-delete-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(modal.openConfirm).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ confirmKind: 'danger', stack: true }),
    );
    expect(update).toHaveBeenCalledOnceWith('project', [
      { id: 'keep', title: keep.title, note: keep.note, sub_items: [] },
      { id: 'new', title: added.title, note: null, sub_items: [] },
    ]);
    expect(modal.close).toHaveBeenCalledTimes(1);
    expect(notifications.showSuccess).toHaveBeenCalledWith('todos.checklistDeleted');
  });

  it('has no delete action while adding a checklist and uses the shared icons with accessible mobile actions', () => {
    const adding = editor(null);
    expect(adding.nativeElement.querySelector('.checklist-delete-btn')).toBeNull();
    adding.destroy();
    const editing = editor();
    const buttons = editing.nativeElement.querySelectorAll(
      '.form-actions button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons.forEach((button) => {
      expect(button.querySelector('app-icon svg')).not.toBeNull();
      expect(button.getAttribute('aria-label')).toBeTruthy();
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      if (window.matchMedia('(max-width: 768px)').matches)
        expect(getComputedStyle(button.querySelector('.action-label')!).display).toBe('none');
    });
    const actionButtons = [...buttons];
    expect(new Set(actionButtons.map((button) => button.getBoundingClientRect().height)).size).toBe(
      1,
    );
    for (const button of actionButtons) {
      expect(
        Math.abs(button.getBoundingClientRect().top - actionButtons[0].getBoundingClientRect().top),
      ).toBeLessThanOrEqual(1);
    }
    expect(
      editing.nativeElement
        .querySelector('.cancel-action app-icon svg')
        .getAttribute('stroke-width'),
    ).toBe('2.5');
    expect(
      editing.nativeElement
        .querySelector('.submit-action app-icon svg')
        .getAttribute('stroke-width'),
    ).toBe('2.5');
    editing.componentInstance.addSubItem();
    editing.detectChanges();
    if (window.matchMedia('(max-width: 768px)').matches) {
      const colors = editing.nativeElement.querySelector('.color-picker').getBoundingClientRect();
      const remove = editing.nativeElement
        .querySelector('.sub-item-delete')
        .getBoundingClientRect();
      expect(
        Math.abs(colors.top + colors.height / 2 - remove.top - remove.height / 2),
      ).toBeLessThanOrEqual(1);
    }
  });

  it('does nothing when deletion is cancelled', async () => {
    modal.openConfirm.and.resolveTo(false);
    await editor().componentInstance.deleteChecklist();
    expect(update).not.toHaveBeenCalled();
    expect(modal.close).not.toHaveBeenCalled();
  });

  it('allows deleting the last checklist', async () => {
    project.set({ ...project()!, todo_items: [target] });
    await editor().componentInstance.deleteChecklist();
    expect(update).toHaveBeenCalledOnceWith('project', []);
  });

  it('keeps the editor open after a failed delete and permits retry', async () => {
    update.and.returnValue(throwError(() => new Error('Delete failed')));
    const fixture = editor();
    await fixture.componentInstance.deleteChecklist();
    expect(modal.close).not.toHaveBeenCalled();
    expect(fixture.componentInstance.saving).toBeFalse();
    expect(notifications.showError).toHaveBeenCalledWith('Delete failed');
    update.and.returnValue(of({ ...project(), todo_items: [keep] }));
    await fixture.componentInstance.deleteChecklist();
    expect(modal.close).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate requests and dismissal during deletion', async () => {
    const response = new Subject<Project>();
    update.and.returnValue(response);
    const fixture = editor();
    await fixture.componentInstance.deleteChecklist();
    await fixture.componentInstance.deleteChecklist();
    expect(update).toHaveBeenCalledTimes(1);
    expect(modal.setCloseGuard.calls.mostRecent().args[0]()).toBeFalse();
    response.next({ ...project()!, todo_items: [keep] });
    response.complete();
  });

  it('prunes deleted checklist assignments without losing other unsaved assignment edits', () => {
    const fixture = TestBed.createComponent(ProjectTodoAssignToChecklistsPanelComponent);
    const object = {
      _id: { $oid: 'object' },
      address: { house_number: '12' },
      note: '',
      todo_entries: [
        { todo_item_id: 'remove', status: 'under_process' },
        { todo_item_id: 'keep', status: 'under_process' },
      ],
    };
    fixture.componentRef.setInput('projectId', 'project');
    fixture.componentRef.setInput('todoItems', [target, keep]);
    fixture.componentRef.setInput('objects', [object]);
    fixture.detectChanges();
    fixture.componentInstance.toggleChecklist(target);
    fixture.componentInstance.onObjectEntriesChange(object, [
      object.todo_entries[0],
      { todo_item_id: 'keep', status: 'finished' },
    ]);
    fixture.componentRef.setInput('todoItems', [keep]);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedChecklistIds()).toEqual([]);
    expect(fixture.componentInstance.entriesForObject('object')).toEqual([
      { todo_item_id: 'keep', status: 'finished' },
    ]);
    expect(fixture.componentInstance.dirtyObjectCount()).toBe(1);
  });
});
