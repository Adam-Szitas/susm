import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { PublicFeedbackView } from '@models';
import { ChecklistFeedbackService } from '@services/checklist-feedback.service';
import { DateFormatService } from '@services/date-format.service';
import { TranslationService } from '@services/translation.service';
import { ChecklistFeedbackPublicComponent } from './checklist-feedback-public.component';

describe('public checklist feedback page', () => {
  const token = 'a'.repeat(64);
  let api: jasmine.SpyObj<ChecklistFeedbackService>;
  let translation: { setLanguageOverride: jasmine.Spy; instant: (key: string) => string };
  let fixture: ComponentFixture<ChecklistFeedbackPublicComponent>;

  const view = (): PublicFeedbackView => ({
    locale: 'de',
    project_name: 'Musterstraße',
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'visitor@example.com',
    checklists: [
      {
        id: 'cl1',
        title: 'Windows',
        sub_items: [],
        objects: [
          {
            object_id: 'o1',
            address: { house_number: '1' },
            prefix: 'A1',
            status: 'under_process',
            my_notes: [{ id: 'n1', body: 'my earlier note', created_at: new Date().toISOString() }],
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    api = jasmine.createSpyObj<ChecklistFeedbackService>('ChecklistFeedbackService', [
      'publicGate',
      'publicSession',
      'publicView',
      'publicSubmit',
    ]);
    api.publicGate.and.returnValue(
      of({
        kind: 'ok',
        data: {
          status: 'open',
          locale: 'de',
          project_name: 'Musterstraße',
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          checklist_count: 1,
        },
      }),
    );
    api.publicSession.and.returnValue(
      of({
        kind: 'ok',
        data: { session_token: 'sess', session_expires_at: Date.now() / 1000 + 3600, email: 'visitor@example.com' },
      }),
    );
    api.publicView.and.callFake(() => of({ kind: 'ok', data: view() }));
    api.publicSubmit.and.returnValue(of({ kind: 'ok', data: { id: 'sub1', status: 'pending', change_count: 1 } }));
    translation = { setLanguageOverride: jasmine.createSpy(), instant: (key: string) => key };

    TestBed.configureTestingModule({
      imports: [ChecklistFeedbackPublicComponent, TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ChecklistFeedbackService, useValue: api },
        { provide: TranslationService, useValue: translation },
        { provide: DateFormatService, useValue: { format: () => 'date' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token }) } } },
      ],
    });
    fixture = TestBed.createComponent(ChecklistFeedbackPublicComponent);
  });

  async function render(): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('uses the share locale and asks for an email before showing any checklist data', async () => {
    const el = await render();
    expect(translation.setLanguageOverride).toHaveBeenCalledWith('de');
    expect(el.querySelector('#cfbEmail')).not.toBeNull();
    expect(el.textContent).not.toContain('my earlier note');
    expect(api.publicView).not.toHaveBeenCalled();
  });

  it('rejects malformed emails locally and accepts any well-formed one', async () => {
    await render();
    const component = fixture.componentInstance;
    component.email.set('not-an-email');
    component.identify();
    expect(api.publicSession).not.toHaveBeenCalled();
    component.email.set('Visitor@Example.com');
    component.identify();
    expect(api.publicSession).toHaveBeenCalledWith(token, 'Visitor@Example.com');
    const el = await render();
    expect(component.state()).toBe('editing');
    expect(el.textContent).toContain('my earlier note');
  });

  async function startEditing(): Promise<HTMLElement> {
    await render();
    fixture.componentInstance.email.set('visitor@example.com');
    fixture.componentInstance.identify();
    return render();
  }

  it('sets the status with visible radio choices and a note via "Add note", then submits', async () => {
    let el = await startEditing();
    const component = fixture.componentInstance;
    const checklist = component.checklists()[0];
    const row = checklist.objects[0];

    const radios = Array.from(el.querySelectorAll<HTMLInputElement>('.cfb-choices input[type="radio"]'));
    expect(radios.map((radio) => radio.value)).toEqual(['under_process', 'finished']);
    expect(radios[0].checked).toBeTrue();
    expect(el.querySelector('textarea')).toBeNull();

    radios[1].click();
    (el.querySelector<HTMLButtonElement>('.cfb-add-note'))!.click();
    el = await render();
    const textarea = el.querySelector<HTMLTextAreaElement>('textarea')!;
    textarea.value = 'window fixed';
    textarea.dispatchEvent(new Event('input'));
    el = await render();

    expect(component.dirty(checklist, row)).toEqual({ status: true, note: true });
    expect(el.querySelectorAll('.cfb-row--dirty').length).toBe(1);
    expect(el.querySelectorAll('.cfb-flag').length).toBe(1);
    expect(el.querySelector('.cfb-submit-status')?.textContent).toContain('checklistFeedback.public.pendingSummary');
    expect(el.querySelector<HTMLButtonElement>('.cfb-send')!.disabled).toBeFalse();

    el.querySelector<HTMLButtonElement>('.cfb-send')!.click();
    expect(api.publicSubmit).toHaveBeenCalledWith(token, 'sess', [
      { object_id: 'o1', todo_item_id: 'cl1', status: 'finished', note_text: 'window fixed' },
    ]);
    el = await render();
    expect(component.state()).toBe('submitted');
    component.continueEditing();
    el = await render();
    expect(el.querySelectorAll('.cfb-flag').length).toBe(0);
    expect(el.querySelector('textarea')).toBeNull();
  });

  it('undo restores the loaded status and closes the note', async () => {
    let el = await startEditing();
    const component = fixture.componentInstance;
    const checklist = component.checklists()[0];
    const row = checklist.objects[0];
    component.setStatus(checklist, row, 'finished');
    component.openNote(checklist, row);
    el = await render();
    el.querySelector<HTMLButtonElement>('.cfb-icon-button')!.click();
    el = await render();
    expect(component.changeCount()).toBe(0);
    expect(el.querySelector('.cfb-row--dirty')).toBeNull();
    expect(el.querySelector('textarea')).toBeNull();
    expect(el.querySelector<HTMLButtonElement>('.cfb-send')!.disabled).toBeTrue();
  });

  it('offers sub-items as radio choices and sends the chosen sub-item', async () => {
    api.publicView.and.callFake(() => {
      const data = view();
      data.checklists[0].sub_items = [
        { id: 's1', title: 'Montage', color: 'red' },
        { id: 's2', title: 'Demontage', color: 'blue' },
      ];
      data.checklists[0].objects[0].todo_sub_item_id = 's1';
      return of({ kind: 'ok', data });
    });
    let el = await startEditing();
    const radios = Array.from(el.querySelectorAll<HTMLInputElement>('.cfb-choices input[type="radio"]'));
    expect(radios.map((radio) => radio.value)).toEqual(['s1', 's2']);
    expect(radios[0].checked).toBeTrue();
    radios[1].click();
    el = await render();
    fixture.componentInstance.submit();
    expect(api.publicSubmit).toHaveBeenCalledWith(token, 'sess', [
      jasmine.objectContaining({ object_id: 'o1', todo_item_id: 'cl1', todo_sub_item_id: 's2' }),
    ]);
  });

  it('clamps long checklist descriptions behind "Show more"', async () => {
    api.publicView.and.callFake(() => {
      const data = view();
      data.checklists[0].note = 'Entkopplung '.repeat(40);
      return of({ kind: 'ok', data });
    });
    let el = await startEditing();
    const text = () => el.querySelector('.cfb-description-text')!;
    const toggle = () => el.querySelector<HTMLButtonElement>('.cfb-description .cfb-link-button')!;
    expect(text().classList).toContain('cfb-description-text--clamped');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    toggle().click();
    el = await render();
    expect(text().classList).not.toContain('cfb-description-text--clamped');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('flags changed fields and clears the flags after a successful submit', async () => {
    await render();
    const component = fixture.componentInstance;
    component.email.set('visitor@example.com');
    component.identify();
    await render();
    const checklist = component.checklists()[0];
    const row = checklist.objects[0];
    component.setStatus(checklist, row, 'finished');
    component.onNoteInput(checklist, row, 'window fixed');
    let el = await render();
    expect(component.dirty(checklist, row)).toEqual({ status: true, note: true });
    expect(el.querySelectorAll('.cfb-flag').length).toBe(1);

    component.submit();
    expect(api.publicSubmit).toHaveBeenCalledWith(token, 'sess', [
      { object_id: 'o1', todo_item_id: 'cl1', status: 'finished', note_text: 'window fixed' },
    ]);
    el = await render();
    expect(component.state()).toBe('submitted');
    expect(component.changeCount()).toBe(0);
    component.continueEditing();
    el = await render();
    expect(el.querySelectorAll('.cfb-flag').length).toBe(0);
  });

  it('shows a locked state without edit controls when the link expired', async () => {
    api.publicGate.and.returnValue(
      of({ kind: 'gone', gone: { error: 'gone', status: 'expired', locale: 'sk' } }),
    );
    const el = await render();
    expect(fixture.componentInstance.state()).toBe('gone');
    expect(translation.setLanguageOverride).toHaveBeenCalledWith('sk');
    expect(el.querySelector('input, textarea, select')).toBeNull();
  });
});
