import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Object as ProjectObject, TodoItem } from '@models';
import { of, throwError } from 'rxjs';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { ChecklistFeedbackShareModalComponent } from '../checklist-feedback/checklist-feedback-share-modal.component';
import { ProjectTodoAssignToChecklistsPanelComponent } from './project-todo-assign-to-checklists-panel.component';

describe('checklist panel feedback share entry point', () => {
  const items: TodoItem[] = [
    { _id: { $oid: 'cl1' }, title: 'Windows', sort_order: 0 },
    { _id: { $oid: 'cl2' }, title: 'Doors', sort_order: 1 },
  ];
  let modal: { open: jasmine.Spy; setCloseGuard: jasmine.Spy; clearCloseGuard: jasmine.Spy };
  const sharingEnabled = signal(true);

  beforeEach(() => {
    sharingEnabled.set(true);
    modal = {
      open: jasmine.createSpy('open'),
      setCloseGuard: jasmine.createSpy('setCloseGuard'),
      clearCloseGuard: jasmine.createSpy('clearCloseGuard'),
    };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProjectStore, useValue: {} },
        { provide: ModalService, useValue: modal },
        { provide: NotificationService, useValue: {} },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        { provide: UserStore, useValue: { externalSharingEnabled: sharingEnabled } },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(ProjectTodoAssignToChecklistsPanelComponent);
    fixture.componentRef.setInput('projectId', 'project');
    fixture.componentRef.setInput('todoItems', items);
    fixture.componentRef.setInput('objects', []);
    fixture.detectChanges();
    const button = () =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.checklist-feedback-share-btn');
    return { fixture, button };
  }

  it('is disabled with no checklist selected and enabled with at least one', () => {
    const { fixture, button } = render();
    expect(button()?.disabled).toBeTrue();
    fixture.componentInstance.toggleChecklist(items[1]);
    fixture.detectChanges();
    expect(button()?.disabled).toBeFalse();
  });

  it('opens the composer with only the selected checklists', () => {
    const { fixture, button } = render();
    fixture.componentInstance.toggleChecklist(items[1]);
    fixture.detectChanges();
    button()!.click();
    expect(modal.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        component: ChecklistFeedbackShareModalComponent,
        componentInputs: {
          projectId: 'project',
          todoItems: [items[1]],
          allTodoItems: items,
          assignedObjectCounts: { cl2: 0 },
        },
      }),
    );
  });

  it('is hidden when external sharing is disabled for the company', () => {
    sharingEnabled.set(false);
    const { button } = render();
    expect(button()).toBeNull();
  });
});

// Regression: the public page reads *saved* assignments. Sharing while the panel had unsaved
// unassignments showed objects on the link that looked unassigned in the panel.
describe('checklist panel share with unsaved assignment changes', () => {
  const item: TodoItem = { _id: { $oid: 'cl1' }, title: 'Windows', sort_order: 0 };
  const object: ProjectObject = {
    _id: { $oid: 'obj1' },
    todo_entries: [{ todo_item_id: { $oid: 'cl1' }, status: 'under_process' }],
  } as unknown as ProjectObject;
  let modal: {
    open: jasmine.Spy;
    openConfirm: jasmine.Spy;
    setCloseGuard: jasmine.Spy;
    clearCloseGuard: jasmine.Spy;
  };
  let store: { updateObjectTodos: jasmine.Spy };
  let notifications: { showSuccess: jasmine.Spy; showError: jasmine.Spy };

  beforeEach(() => {
    modal = {
      open: jasmine.createSpy('open'),
      openConfirm: jasmine.createSpy('openConfirm').and.resolveTo(true),
      setCloseGuard: jasmine.createSpy('setCloseGuard'),
      clearCloseGuard: jasmine.createSpy('clearCloseGuard'),
    };
    store = { updateObjectTodos: jasmine.createSpy('updateObjectTodos').and.returnValue(of({})) };
    notifications = { showSuccess: jasmine.createSpy('showSuccess'), showError: jasmine.createSpy('showError') };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProjectStore, useValue: store },
        { provide: ModalService, useValue: modal },
        { provide: NotificationService, useValue: notifications },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        { provide: UserStore, useValue: { externalSharingEnabled: signal(true) } },
      ],
    });
  });

  function renderWithUnsavedUnassignment() {
    const fixture = TestBed.createComponent(ProjectTodoAssignToChecklistsPanelComponent);
    fixture.componentRef.setInput('projectId', 'project');
    fixture.componentRef.setInput('todoItems', [item]);
    fixture.componentRef.setInput('objects', [object]);
    fixture.detectChanges();
    const panel = fixture.componentInstance;
    panel.toggleChecklist(item);
    panel.onObjectEntriesChange(object, []);
    expect(panel.dirtyObjectCount()).toBe(1);
    return panel;
  }

  it('asks to save, saves the unassignment, then opens the composer', async () => {
    const order: string[] = [];
    store.updateObjectTodos.and.callFake(() => {
      order.push('save');
      return of({});
    });
    modal.open.and.callFake(() => order.push('open'));
    const panel = renderWithUnsavedUnassignment();
    await panel.shareForFeedback();
    expect(order).toEqual(['save', 'open']);

    expect(modal.openConfirm).toHaveBeenCalledWith(
      jasmine.objectContaining({ confirmText: 'checklistFeedback.share.saveAndShare' }),
    );
    expect(store.updateObjectTodos).toHaveBeenCalledOnceWith('obj1', []);
    expect(panel.dirtyObjectCount()).toBe(0);
    expect(modal.open).toHaveBeenCalledWith(
      jasmine.objectContaining({ component: ChecklistFeedbackShareModalComponent }),
    );
  });

  it('passes saved assignment counts to the composer', async () => {
    const panel = renderWithUnsavedUnassignment();
    await panel.shareForFeedback();
    expect(modal.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        componentInputs: jasmine.objectContaining({ assignedObjectCounts: { cl1: 0 } }),
      }),
    );
  });

  it('counts saved assignments when nothing is dirty', async () => {
    const fixture = TestBed.createComponent(ProjectTodoAssignToChecklistsPanelComponent);
    fixture.componentRef.setInput('projectId', 'project');
    fixture.componentRef.setInput('todoItems', [item]);
    fixture.componentRef.setInput('objects', [object]);
    fixture.detectChanges();
    fixture.componentInstance.toggleChecklist(item);
    await fixture.componentInstance.shareForFeedback();
    expect(modal.openConfirm).not.toHaveBeenCalled();
    expect(modal.open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        componentInputs: jasmine.objectContaining({ assignedObjectCounts: { cl1: 1 } }),
      }),
    );
  });

  it('does not save or share when the user cancels', async () => {
    modal.openConfirm.and.resolveTo(false);
    const panel = renderWithUnsavedUnassignment();
    await panel.shareForFeedback();

    expect(store.updateObjectTodos).not.toHaveBeenCalled();
    expect(modal.open).not.toHaveBeenCalled();
    expect(panel.dirtyObjectCount()).toBe(1);
  });

  it('does not share when saving fails', async () => {
    store.updateObjectTodos.and.returnValue(throwError(() => new Error('boom')));
    const panel = renderWithUnsavedUnassignment();
    await panel.shareForFeedback();

    expect(notifications.showError).toHaveBeenCalled();
    expect(modal.open).not.toHaveBeenCalled();
    expect(panel.dirtyObjectCount()).toBe(1);
  });
});
