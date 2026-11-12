import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ChecklistFeedbackShare, TodoItem } from '@models';
import { ChecklistFeedbackService } from '@services/checklist-feedback.service';
import { DateFormatService } from '@services/date-format.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ChecklistFeedbackShareModalComponent } from './checklist-feedback-share-modal.component';

describe('checklist feedback share composer', () => {
  const items: TodoItem[] = [
    { _id: { $oid: 'cl1' }, title: 'Windows', sort_order: 0 },
    { _id: { $oid: 'cl2' }, title: 'Doors', sort_order: 1 },
  ];
  const share = (id: string): ChecklistFeedbackShare => ({
    id,
    token: id.repeat(8),
    url: `https://app.test/checklist-feedback/${id}`,
    expires_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
    created_at: new Date().toISOString(),
    status: 'open',
    todo_item_ids: ['cl1', 'cl2'],
    pending_count: 0,
  });
  let api: jasmine.SpyObj<ChecklistFeedbackService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ChecklistFeedbackService>('ChecklistFeedbackService', [
      'createShares',
      'listShares',
      'revokeShare',
    ]);
    api.listShares.and.returnValue(of([]));
    api.createShares.and.returnValue(of([share('a'), share('b')]));
    TestBed.configureTestingModule({
      imports: [ChecklistFeedbackShareModalComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ChecklistFeedbackService, useValue: api },
        { provide: ModalService, useValue: { open: jasmine.createSpy(), openConfirm: () => Promise.resolve(true) } },
        { provide: NotificationService, useValue: { showError: jasmine.createSpy(), showSuccess: jasmine.createSpy() } },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        { provide: DateFormatService, useValue: { format: () => 'date' } },
      ],
    });
  });

  it('creates several copyable links for the selected checklists without any email fields', async () => {
    const fixture = TestBed.createComponent(ChecklistFeedbackShareModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('todoItems', items);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setCount(2);
    component.label.set('Contractor');
    component.create();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.createShares).toHaveBeenCalledWith('p1', ['cl1', 'cl2'], 2, 'Contractor');
    const el = fixture.nativeElement as HTMLElement;
    const urls = Array.from(el.querySelectorAll<HTMLInputElement>('.cfs-url')).map((input) => input.value);
    expect(urls).toEqual(['https://app.test/checklist-feedback/a', 'https://app.test/checklist-feedback/b']);
    expect(el.querySelector('input[type="email"]')).toBeNull();
  });

  it('blocks creating a link when no selected checklist has assigned objects', () => {
    const fixture = TestBed.createComponent(ChecklistFeedbackShareModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('todoItems', items);
    fixture.componentRef.setInput('assignedObjectCounts', { cl1: 0, cl2: 0 });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.canCreate()).toBeFalse();
    expect(el.querySelector<HTMLButtonElement>('.cfs-create-btn')!.disabled).toBeTrue();
    expect(el.querySelector('.cfs-warning')?.textContent).toContain('checklistFeedback.share.noAssignedObjects');
    fixture.componentInstance.create();
    expect(api.createShares).not.toHaveBeenCalled();
  });

  it('allows a link when at least one checklist has objects and flags the empty ones', () => {
    const fixture = TestBed.createComponent(ChecklistFeedbackShareModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('todoItems', items);
    fixture.componentRef.setInput('assignedObjectCounts', { cl1: 3, cl2: 0 });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.canCreate()).toBeTrue();
    expect(el.querySelectorAll('.cfs-chip--empty').length).toBe(1);
    expect(el.querySelector('.cfs-warning')?.textContent).toContain('checklistFeedback.share.emptyHidden');
  });

  it('clamps the link count to 1..20', () => {
    const fixture = TestBed.createComponent(ChecklistFeedbackShareModalComponent);
    const component = fixture.componentInstance;
    component.setCount(0);
    expect(component.count()).toBe(1);
    component.setCount(99);
    expect(component.count()).toBe(20);
    component.setCount('abc');
    expect(component.count()).toBe(1);
  });

  it('copies the full URL to the clipboard', async () => {
    const write = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    const fixture = TestBed.createComponent(ChecklistFeedbackShareModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('todoItems', items);
    await fixture.componentInstance.copy(share('a'));
    expect(write).toHaveBeenCalledWith('https://app.test/checklist-feedback/a');
    expect(fixture.componentInstance.copiedId()).toBe('a');
  });
});
