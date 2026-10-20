import { ApplicationRef, Component, input, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectTodoModalComponent } from '../components/todos/project-todo-modal.component';
import { ModalService } from './modal.service';

@Component({
  selector: 'app-modal-body-probe',
  standalone: true,
  template: `<p class="probe-marker">probe:{{ label() }}</p>`,
})
class ModalBodyProbeComponent {
  label = input('ok');
}

describe('ModalService', () => {
  let service: ModalService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideRouter([]),
        ModalService,
      ],
    });
    service = TestBed.inject(ModalService);
  });

  afterEach(() => {
    service.closeAll();
  });

  it('renders dynamic body content into the modal (VCR, zoneless-safe)', () => {
    const { childRef } = service.open({
      title: 'Probe',
      component: ModalBodyProbeComponent,
      componentInputs: { label: 'checklist' },
      extraWide: true,
    });

    expect(childRef).toBeTruthy();

    const host = document.querySelector('.modal-host');
    expect(host).toBeTruthy();

    const marker = host!.querySelector('.probe-marker');
    expect(marker?.textContent?.trim()).toBe('probe:checklist');

    const content = host!.querySelector('.modal-content');
    expect(content?.classList.contains('wide-xl')).toBe(true);
    expect(content?.classList.contains('wide')).toBe(false);
  });

  it('renders the project checklist modal body', () => {
    service.open({
      title: 'todos.projectChecklist',
      component: ProjectTodoModalComponent,
      componentInputs: {
        projectId: 'proj-1',
        todoItems: [
          {
            _id: { $oid: 'todo-1' },
            title: 'Checklist Alpha',
            sort_order: 0,
            sub_items: [],
          },
        ],
        objects: [
          {
            _id: { $oid: 'obj-1' },
            address: { house_number: '12' },
            note: '',
          },
        ],
      },
      extraWide: true,
    });

    const host = document.querySelector('.modal-host')!;
    const body = host.querySelector('.modal-body') as HTMLElement;
    const form = host.querySelector('.project-todo-form') as HTMLElement | null;
    const content = host.querySelector('.modal-content') as HTMLElement;
    const text = (body.textContent ?? '').replace(/\s+/g, ' ').trim();
    const metrics = {
      innerWidth: window.innerWidth,
      text: text.slice(0, 180),
      bodyH: Math.round(body.getBoundingClientRect().height),
      formH: Math.round(form?.getBoundingClientRect().height ?? -1),
      contentH: Math.round(content.getBoundingClientRect().height),
      contentClass: content.className,
      formClass: form?.className ?? null,
      child: body.firstElementChild?.tagName ?? null,
    };

    expect(form).withContext(JSON.stringify(metrics)).not.toBeNull();
    expect(metrics.formH).withContext(JSON.stringify(metrics)).toBeGreaterThan(80);

    TestBed.inject(ApplicationRef).tick();

    const bodyAfter = document.querySelector('.modal-body') as HTMLElement | null;
    const formAfter = document.querySelector('.project-todo-form');
    const textAfter = (bodyAfter?.textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(formAfter)
      .withContext(`after tick: ${textAfter.slice(0, 180)} html=${bodyAfter?.innerHTML.slice(0, 200)}`)
      .not.toBeNull();
    expect(textAfter.length).withContext(textAfter).toBeGreaterThan(10);
  });

  it('stacks a second modal and closes only the top one', () => {
    service.open({
      title: 'Base',
      component: ModalBodyProbeComponent,
      componentInputs: { label: 'base' },
    });
    service.open({
      title: 'Top',
      stack: true,
      component: ModalBodyProbeComponent,
      componentInputs: { label: 'top' },
    });

    const hosts = document.querySelectorAll('.modal-host');
    expect(hosts.length).toBe(2);
    expect(hosts[0].textContent).toContain('probe:base');
    expect(hosts[1].textContent).toContain('probe:top');

    service.close();
    const remaining = document.querySelectorAll('.modal-host');
    expect(remaining.length).toBe(1);
    expect(remaining[0].textContent).toContain('probe:base');
  });
});
