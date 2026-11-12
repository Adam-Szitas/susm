import { ApplicationRef, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { Project, TodoItem } from '@models';
import { ModalService } from '@services/modal.service';
import { TranslationService } from '@services/translation.service';
import { NotificationService } from '@services/notification.service';
import { ProjectStore } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { ChecklistNoteModalComponent } from './checklist-note-modal.component';
import { ProjectTodoModalComponent } from './project-todo-modal.component';

describe('shared project checklist note flow', () => {
  let modal: ModalService;
  let source: Project;
  let store: {
    project: ReturnType<typeof signal<Project | null>>;
    loadChecklistNote: jasmine.Spy;
    saveChecklistNote: jasmine.Spy;
    updateProjectTodoItems: jasmine.Spy;
  };
  let notification: { showError: jasmine.Spy; showSuccess: jasmine.Spy };

  beforeEach(() => {
    source = {
      _id: { $oid: 'project' },
      name: 'Inspection project',
      note: 'Existing project details',
      checklist_note: 'Observation\nRepair door',
      checklist_note_lines: [{ id: 'mark-1', line: 1, text: 'Repair door', checklist: true }],
      todo_items: [],
    };
    store = {
      project: signal<Project | null>(null),
      loadChecklistNote: jasmine.createSpy().and.callFake(() => of(source)),
      saveChecklistNote: jasmine.createSpy(),
      updateProjectTodoItems: jasmine.createSpy(),
    };
    notification = { showError: jasmine.createSpy(), showSuccess: jasmine.createSpy() };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        ModalService,
        { provide: ProjectStore, useValue: store },
        { provide: NotificationService, useValue: notification },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        {
          provide: UserStore,
          useValue: { isAdmin: () => true, isSuperuser: () => false, externalSharingEnabled: () => false },
        },
      ],
    });
    modal = TestBed.inject(ModalService);
  });

  afterEach(() => modal.closeAll());

  function open() {
    const result = modal.open({
      component: ChecklistNoteModalComponent,
      wide: true,
      componentInputs: { projectId: 'project' },
    });
    TestBed.inject(ApplicationRef).tick();
    return result.childRef!.instance as ChecklistNoteModalComponent;
  }

  it('creates actual project checklists on submit and returns to the project checklist list', () => {
    const child: TodoItem = {
      _id: { $oid: 'created' },
      title: 'Repair door',
      sort_order: 0,
      source_note_line_id: 'mark-1',
    };
    const saved = { ...source, todo_items: [child] };
    store.saveChecklistNote.and.returnValue(of(saved));
    modal.open({
      component: ProjectTodoModalComponent,
      componentInputs: { projectId: 'project', todoItems: [], objects: [] },
    });
    TestBed.inject(ApplicationRef).tick();
    (document.querySelector('app-checklist-note-button button') as HTMLButtonElement).click();
    TestBed.inject(ApplicationRef).tick();
    expect(document.querySelector('app-checklist-note-editor')).not.toBeNull();
    (
      document.querySelector(
        'app-checklist-note-modal .actions .submit-action',
      ) as HTMLButtonElement
    ).click();
    TestBed.inject(ApplicationRef).tick();
    expect(store.saveChecklistNote).toHaveBeenCalledOnceWith(
      'project',
      source,
      source.checklist_note,
      source.checklist_note_lines,
    );
    expect(document.querySelector('app-checklist-note-modal')).toBeNull();
    expect(document.querySelector('app-project-todo-item-editor-modal')).toBeNull();
    expect(document.querySelector('.checklist-select-title')?.textContent).toContain('Repair door');
    expect(source.checklist_note).toBe('Observation\nRepair door');
    expect(source.note).toBe('Existing project details');
    expect(document.querySelectorAll('.modal-host').length).toBe(1);
  });

  it('keeps failed note edits in the editor for retry and sends the original version for conflict checking', () => {
    store.saveChecklistNote.and.returnValue(throwError(() => new Error('Note changed')));
    const note = open();
    note.edit();
    note.note.set('Observation\nRepair window');
    note.formats.set([{ ...source.checklist_note_lines![0], text: 'Repair window' }]);
    note.save();
    expect(note.editing()).toBeTrue();
    expect(note.saving()).toBeFalse();
    expect(note.note()).toBe('Observation\nRepair window');
    expect(note.current()?.checklist_note).toBe(source.checklist_note);
    expect(store.saveChecklistNote).toHaveBeenCalledWith(
      'project',
      source,
      note.note(),
      note.formats(),
    );
    expect(notification.showError).toHaveBeenCalledWith('Note changed');
  });

  it('keeps long note paragraphs within a narrow panel and provides touch-sized actions', () => {
    source.checklist_note = 'Repair '.repeat(80);
    source.checklist_note_lines = [
      { id: 'long', line: 0, text: source.checklist_note, checklist: true },
    ];
    open();
    const host = document.querySelector('.modal-host') as HTMLElement;
    const dialog = host.querySelector('dialog') as HTMLDialogElement;
    dialog.style.width = '336px';
    TestBed.inject(ApplicationRef).tick();
    const body = host.querySelector('.modal-body') as HTMLElement;
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
    const buttons = host.querySelectorAll('app-checklist-note-content button, .actions button');
    buttons.forEach((button) =>
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44),
    );
  });

  it('has no preview, checklist picker, created list or action hints below the note', () => {
    open();
    const note = document.querySelector('app-checklist-note-modal')!;
    expect(
      note.querySelector('app-checklist-note-content, .created-list, .paragraph-picker'),
    ).toBeNull();
    const editor = note.querySelector('app-checklist-note-editor')!;
    expect(editor.nextElementSibling?.tagName).toBe('FOOTER');
    expect(editor.querySelector('.editor-surface')?.nextElementSibling).toBeNull();
  });

  it('lets read-only users view notes without editing or creating checklists', () => {
    spyOn(TestBed.inject(UserStore), 'isAdmin').and.returnValue(false);
    const note = open();
    expect(note.canEdit()).toBeFalse();
    expect(document.querySelector('app-checklist-note-content')?.textContent).toContain(
      'Repair door',
    );
    expect(
      document.querySelectorAll('app-checklist-note-content button, .actions .submit-action')
        .length,
    ).toBe(0);
    expect(document.querySelectorAll('.modal-host').length).toBe(1);
  });
  it('has exactly one shared note button in the project modal regardless of the number of checklists', async () => {
    const checklists: TodoItem[] = [
      { _id: { $oid: 'one' }, title: 'First checklist', sort_order: 0 },
      { _id: { $oid: 'two' }, title: 'Second checklist', sort_order: 1 },
    ];
    modal.open({
      component: ProjectTodoModalComponent,
      componentInputs: {
        projectId: 'project',
        todoItems: checklists,
        objects: [],
      },
    });
    TestBed.inject(ApplicationRef).tick();
    const buttons = document.querySelectorAll('app-checklist-note-button button');
    expect(buttons.length).toBe(1);
    expect(document.querySelector('.checklist-select-list app-checklist-note-button')).toBeNull();
    (buttons[0] as HTMLButtonElement).click();
    TestBed.inject(ApplicationRef).tick();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(store.loadChecklistNote).toHaveBeenCalledOnceWith('project');
    expect(
      (document.querySelector('app-checklist-note-editor textarea') as HTMLTextAreaElement)?.value,
    ).toContain('Repair door');
  });

  it('reloads the shared project note after closing and reopening, even with no checklists', () => {
    const note = open();
    note.edit();
    note.note.set('A new project-wide note');
    note.formats.set([]);
    const saved = { ...source, checklist_note: note.note(), checklist_note_lines: [] };
    store.saveChecklistNote.and.returnValue(of(saved));
    store.loadChecklistNote.and.returnValue(of(saved));
    note.save();
    const reopened = open();
    expect(reopened.current()?.checklist_note).toBe('A new project-wide note');
    expect(reopened.current()?.todo_items).toEqual([]);
    expect(store.loadChecklistNote).toHaveBeenCalledTimes(2);
  });

  for (const [language, label] of [
    ['en', 'Project checklist note'],
    ['sk', 'Poznámka ku kontrolným zoznamom projektu'],
    ['de', 'Notiz zu den Projekt-Checklisten'],
  ]) {
    it(`shows the translated global note button in ${language} within a mobile-width modal`, () => {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation(language, {
        'noteChecklist.note': label,
        'noteChecklist.open': label,
      });
      translate.use(language);
      modal.open({
        component: ProjectTodoModalComponent,
        componentInputs: {
          projectId: 'project',
          todoItems: [],
          objects: [],
        },
      });
      TestBed.inject(ApplicationRef).tick();
      const host = document.querySelector('.modal-host') as HTMLElement;
      const dialog = host.querySelector('dialog') as HTMLDialogElement;
      dialog.style.width = '336px';
      const button = host.querySelector('app-checklist-note-button button') as HTMLButtonElement;
      expect(button.getAttribute('title')).toBe(label);
      const footer = button.closest('footer.form-actions')!;
      expect(footer).not.toBeNull();
      expect(footer.querySelector('.form-actions-start')?.firstElementChild?.tagName).toBe(
        'APP-CHECKLIST-NOTE-BUTTON',
      );
      expect(
        Math.abs(button.getBoundingClientRect().left - footer.getBoundingClientRect().left),
      ).toBeLessThanOrEqual(1);
      expect(button.querySelector('app-icon svg')).not.toBeNull();
      expect(button.getAttribute('aria-label')).toBeTruthy();
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
        dialog.getBoundingClientRect().right + 1,
      );
      const body = host.querySelector('.modal-body') as HTMLElement;
      expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
    });
  }
});
