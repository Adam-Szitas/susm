import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TodoItem } from '@models';
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
        componentInputs: { projectId: 'project', todoItems: [items[1]], allTodoItems: items },
      }),
    );
  });

  it('is hidden when external sharing is disabled for the company', () => {
    sharingEnabled.set(false);
    const { button } = render();
    expect(button()).toBeNull();
  });
});
