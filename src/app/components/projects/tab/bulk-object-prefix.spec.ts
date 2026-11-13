import { CommonModule } from '@angular/common';
import {
  EventEmitter,
  NO_ERRORS_SCHEMA,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { Object as ProjectObject, Project } from '@models';
import { IconComponent } from '@icons/icon.component';
import { ProjectStore, BulkObjectPrefixResult } from '@store/project.store';
import { UserStore } from '@store/user.store';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { DateFormatService } from '@services/date-format.service';
import { FileService } from '@services/file.service';
import { ProtocolService } from '@services/protocol.service';
import { FilterPersistenceService } from '@services/filter-persistence.service';
import { ObjectCardComponent } from '../../shared/object-card.component';
import { VirtualScrollViewportComponent } from '../../shared/virtual-scroll-viewport.component';
import { TabGroupComponent } from '../../shared/tab-group.component';
import { TabPanelComponent } from '../../shared/tab-panel.component';
import { ProjectTabComponent } from './project-tab.component';
import { BulkObjectPrefixModalComponent } from './bulk-object-prefix-modal.component';
import { FilteredObjectSelection } from '../../../utils/filtered-object-selection';

const object = (id: string, prefix = 'A'): ProjectObject => ({
  _id: { $oid: id },
  address: { house_number: id },
  prefix,
  note: '',
});

describe('filtered object selection', () => {
  it('selects every filtered result beyond rendered rows, handles partial selection and prunes hidden objects', () => {
    const objects = signal(Array.from({ length: 250 }, (_, index) => object(String(index))));
    const selection = new FilteredObjectSelection(objects);
    selection.toggle('0');
    expect(selection.count()).toBe(0);
    selection.enter();
    selection.toggle('0');
    expect(selection.indeterminate()).toBeTrue();
    selection.toggleAll();
    expect(selection.count()).toBe(250);
    expect(selection.allSelected()).toBeTrue();
    objects.set([objects()[1]]);
    selection.reconcile();
    expect(selection.ids()).toEqual(['1']);
    objects.set([object('0'), object('1')]);
    expect(selection.ids()).toEqual(['1']);
    selection.toggleAll();
    expect(selection.count()).toBe(2);
    selection.toggleAll();
    expect(selection.count()).toBe(0);
    selection.exit();
    expect(selection.active()).toBeFalse();
  });
});

describe('project object selection toolbar', () => {
  let project: ReturnType<typeof signal<Project | null>>;
  let objects: ReturnType<typeof signal<ProjectObject[]>>;
  let open: jasmine.Spy;
  let saved: EventEmitter<void>;

  beforeEach(() => {
    project = signal<Project | null>({ _id: { $oid: 'project' }, name: 'Project' });
    objects = signal([object('1'), object('2'), object('3', 'B')]);
    saved = new EventEmitter<void>();
    open = jasmine.createSpy().and.returnValue({ childRef: { instance: { saved } } });
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ProjectStore, useValue: { project, objects, files: signal([]) } },
        { provide: ModalService, useValue: { open } },
        {
          provide: UserStore,
          useValue: {
            isAdmin: () => false,
            streetPlanEnabled: () => false,
            protocolsEnabled: () => false,
          },
        },
        { provide: NotificationService, useValue: {} },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
        { provide: DateFormatService, useValue: { format: () => '' } },
        { provide: FileService, useValue: {} },
        { provide: ProtocolService, useValue: {} },
        {
          provide: FilterPersistenceService,
          useValue: { restore: () => null, save: jasmine.createSpy() },
        },
      ],
    });
    // Keep the real project template and object list; unrelated file/filter widgets are placeholders.
    TestBed.overrideComponent(ProjectTabComponent, {
      set: {
        imports: [
          CommonModule,
          TranslateModule,
          IconComponent,
          ObjectCardComponent,
          VirtualScrollViewportComponent,
          TabGroupComponent,
          TabPanelComponent,
        ],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });
  });

  async function page() {
    const fixture = TestBed.createComponent(ProjectTabComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('shows exactly two icon buttons in selection mode and toggles cards without navigation', async () => {
    const fixture = await page();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.object-select-toggle')!.click();
    fixture.detectChanges();
    const header = host.querySelector('.objects-section > header')!;
    const buttons = header.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(header.querySelector('h3')).toBeNull();
    expect(buttons[0].querySelector('app-icon')).not.toBeNull();
    expect(buttons[1].querySelector('app-icon')).not.toBeNull();
    expect(buttons[1].disabled).toBeTrue();
    const row = host.querySelector<HTMLElement>('.object-selection-row')!;
    expect(row.querySelector('.card--linked')).toBeNull();
    row.querySelector<HTMLElement>('.headline-text')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.objectSelection.count()).toBe(1);
    expect(buttons[1].disabled).toBeFalse();
    const all = host.querySelector<HTMLInputElement>('.object-select-all input')!;
    expect(all.indeterminate).toBeTrue();
    buttons[1].click();
    expect(open).toHaveBeenCalledWith(
      jasmine.objectContaining({
        component: BulkObjectPrefixModalComponent,
        componentInputs: { projectId: 'project', objectIds: ['1'] },
      }),
    );
    saved.emit();
    fixture.detectChanges();
    expect(fixture.componentInstance.objectSelection.active()).toBeFalse();
    expect(host.querySelector('.object-select-toggle')).not.toBeNull();
  });

  it('selects only filtered objects, exits reorder mode, prunes hidden selections and resets on archive/project change', async () => {
    const fixture = await page();
    const component = fixture.componentInstance;
    component.toggleObjectReorderMode();
    component.filterChanged({ prefix: 'A' });
    fixture.detectChanges();
    component.enterObjectSelection();
    fixture.detectChanges();
    expect(component.objectReorderMode()).toBeFalse();
    component.objectSelection.toggleAll();
    expect(component.objectSelection.ids()).toEqual(['1', '2']);
    component.toggleObjectReorderMode();
    expect(component.objectReorderMode()).toBeFalse();
    component.filterChanged({ prefix: 'B' });
    fixture.detectChanges();
    expect(component.objectSelection.count()).toBe(0);
    component.filterChanged({});
    fixture.detectChanges();
    expect(component.objectSelection.count()).toBe(0);
    project.set({ ...project()!, archived_at: '2026-11-13' });
    fixture.detectChanges();
    expect(component.objectSelection.active()).toBeFalse();
    component.enterObjectSelection();
    expect(component.objectSelection.active()).toBeFalse();
    project.set({ _id: { $oid: 'next' }, name: 'Next' });
    fixture.detectChanges();
    component.enterObjectSelection();
    component.objectSelection.toggleAll();
    project.set({ _id: { $oid: 'third' }, name: 'Third' });
    fixture.detectChanges();
    expect(component.objectSelection.active()).toBeFalse();
    expect(component.objectSelection.count()).toBe(0);
  });
});

describe('bulk object prefix modal', () => {
  let update: jasmine.Spy;
  let modal: { close: jasmine.Spy; setCloseGuard: jasmine.Spy; clearCloseGuard: jasmine.Spy };
  let notifications: { showError: jasmine.Spy; showSuccess: jasmine.Spy };
  beforeEach(() => {
    update = jasmine.createSpy().and.returnValue(of({ object_ids: ['1', '2'], prefix: 'New' }));
    modal = {
      close: jasmine.createSpy(),
      setCloseGuard: jasmine.createSpy(),
      clearCloseGuard: jasmine.createSpy(),
    };
    notifications = { showError: jasmine.createSpy(), showSuccess: jasmine.createSpy() };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProjectStore, useValue: { updateObjectPrefixes: update } },
        { provide: ModalService, useValue: modal },
        { provide: NotificationService, useValue: notifications },
        { provide: TranslationService, useValue: { instant: (key: string) => key } },
      ],
    });
  });
  async function editor() {
    const fixture = TestBed.createComponent(BulkObjectPrefixModalComponent);
    fixture.componentRef.setInput('projectId', 'project');
    fixture.componentRef.setInput('objectIds', ['1', '2']);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }
  it('validates a prefix, uses icon-only controls and submits one normalized batch', async () => {
    const fixture = await editor();
    const component = fixture.componentInstance;
    for (const prefix of ['', '   ', 'x'.repeat(101), 'line\nline']) {
      component.prefix.set(prefix);
      component.save();
    }
    expect(update).not.toHaveBeenCalled();
    component.prefix.set('🚪'.repeat(100));
    expect(component.valid()).toBeTrue();
    component.prefix.set('  New  ');
    const saved = jasmine.createSpy();
    component.saved.subscribe(saved);
    fixture.detectChanges();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('footer button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent?.trim()).toBe('');
    expect(buttons[1].getAttribute('aria-label')).toBe('common.save');
    component.save();
    expect(update).toHaveBeenCalledOnceWith('project', ['1', '2'], 'New');
    expect(saved).toHaveBeenCalled();
    expect(modal.close).toHaveBeenCalled();
  });
  it('blocks duplicate saves and closing during save, preserves failed drafts, and does not submit on cancel', async () => {
    const response = new Subject<BulkObjectPrefixResult>();
    update.and.returnValue(response);
    const fixture = await editor();
    const component = fixture.componentInstance;
    component.prefix.set('New');
    component.save();
    component.save();
    component.cancel();
    expect(update).toHaveBeenCalledTimes(1);
    expect(modal.close).not.toHaveBeenCalled();
    expect(modal.setCloseGuard.calls.mostRecent().args[0]()).toBeFalse();
    response.error(new Error('Selection changed'));
    expect(component.prefix()).toBe('New');
    expect(component.error()).toBe('Selection changed');
    expect(component.saving()).toBeFalse();
    expect(notifications.showError).toHaveBeenCalledWith('Selection changed');
    update.calls.reset();
    component.cancel();
    expect(modal.close).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
