import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';
import {
  Object as ProjectObject,
  TODO_SUB_ITEM_COLORS,
  TodoItem,
  TodoSubItem,
  TodoSubItemColor,
  normalizeTodoSubItemColor,
  todoItemId,
  todoSubItemId,
} from '@models';
import { TrashIconComponent } from '../shared/trash-icon.component';
import { TabGroupComponent, TabItem } from '../shared/tab-group.component';
import { TabPanelComponent } from '../shared/tab-panel.component';
import { ProjectTodoAssignToChecklistsPanelComponent } from './project-todo-assign-to-checklists-panel.component';

@Component({
  selector: 'app-project-todo-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    TrashIconComponent,
    TabGroupComponent,
    TabPanelComponent,
    ProjectTodoAssignToChecklistsPanelComponent,
  ],
  templateUrl: './project-todo-modal.component.html',
  styleUrl: './project-todo-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTodoModalComponent implements OnInit {
  #fb = inject(FormBuilder);
  #modalService = inject(ModalService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #projectStore = inject(ProjectStore);
  #cdr = inject(ChangeDetectorRef);

  projectId = input.required<string>();
  todoItems = input<TodoItem[]>([]);
  objects = input<ProjectObject[]>([]);

  readonly colorOptions = TODO_SUB_ITEM_COLORS;

  form: FormGroup;
  saving = signal(false);
  activeTab = signal<'items' | 'assignChecklists'>('items');

  /** Items are collapsed by default so long checklists stay scannable. */
  #expandedItems = signal<ReadonlySet<AbstractControl>>(new Set());

  /** Textareas grow natively where `field-sizing` is supported; JS only fills the gap. */
  readonly #supportsFieldSizing =
    typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content') === true;

  readonly checklistTabs = computed<TabItem[]>(() => [
    {
      id: 'assignChecklists',
      label: this.#translationService.instant('todos.assignToChecklists'),
      disabled: !this.canAssign(),
    },
    {
      id: 'items',
      label: this.#translationService.instant('todos.defineItems'),
    },
  ]);

  constructor() {
    this.form = this.#fb.group({
      items: this.#fb.array([]),
      newTitle: [''],
      newNote: [''],
    });
  }

  get itemsArray(): FormArray {
    return this.form.get('items') as FormArray;
  }

  ngOnInit(): void {
    const items = this.todoItems();
    if (items?.length) {
      items.forEach((item) => this.itemsArray.push(this.createItemGroup(item)));
    }
    this.activeTab.set(this.canAssign() ? 'assignChecklists' : 'items');
  }

  subItemsArray(itemIndex: number): FormArray {
    return this.itemsArray.at(itemIndex).get('subItems') as FormArray;
  }

  isItemExpanded(control: AbstractControl): boolean {
    return this.#expandedItems().has(control);
  }

  toggleItemExpanded(control: AbstractControl): void {
    this.#expandedItems.update((expanded) => {
      const next = new Set(expanded);
      if (!next.delete(control)) {
        next.add(control);
      }
      return next;
    });
    this.#cdr.markForCheck();
  }

  itemTitlePreview(control: AbstractControl): string {
    return String(control.get('title')?.value ?? '').trim();
  }

  itemNotePreview(control: AbstractControl): string {
    return String(control.get('note')?.value ?? '').trim();
  }

  subItemCount(control: AbstractControl): number {
    return (control.get('subItems') as FormArray | null)?.length ?? 0;
  }

  autoResizeNote(event: Event): void {
    if (this.#supportsFieldSizing) {
      return;
    }
    const el = event.target as HTMLTextAreaElement | null;
    if (!el || el.nodeName !== 'TEXTAREA') {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  private createSubItemGroup(sub?: TodoSubItem): FormGroup {
    return this.#fb.group({
      id: [sub ? todoSubItemId(sub) : null],
      title: [sub?.title ?? ''],
      color: [normalizeTodoSubItemColor(sub?.color)],
    });
  }

  private createItemGroup(item?: TodoItem): FormGroup {
    return this.#fb.group({
      id: [item ? todoItemId(item) : null],
      title: [item?.title ?? '', [Validators.required]],
      note: [item?.note ?? ''],
      subItems: this.#fb.array((item?.sub_items ?? []).map((sub) => this.createSubItemGroup(sub))),
    });
  }

  addItem(): void {
    const title = this.form.get('newTitle')?.value?.trim();
    if (!title) return;
    const note = this.form.get('newNote')?.value?.trim() || '';
    const group = this.#fb.group({
      id: [null],
      title: [title, [Validators.required]],
      note: [note],
      subItems: this.#fb.array([]),
    });
    this.itemsArray.push(group);
    this.#expandItem(group);
    this.form.patchValue({ newTitle: '', newNote: '' });
  }

  removeItem(control: AbstractControl): void {
    const index = this.itemsArray.controls.indexOf(control);
    if (index === -1) {
      return;
    }
    this.itemsArray.removeAt(index);
    this.#expandedItems.update((expanded) => {
      if (!expanded.has(control)) {
        return expanded;
      }
      const next = new Set(expanded);
      next.delete(control);
      return next;
    });
    this.#cdr.markForCheck();
  }

  #expandItem(control: AbstractControl): void {
    this.#expandedItems.update((expanded) => new Set(expanded).add(control));
  }

  addSubItem(itemIndex: number): void {
    this.subItemsArray(itemIndex).push(this.createSubItemGroup());
    this.#cdr.markForCheck();
  }

  removeSubItem(itemControl: AbstractControl, subControl: AbstractControl): void {
    const itemIndex = this.itemsArray.controls.indexOf(itemControl);
    if (itemIndex === -1) {
      return;
    }
    const subItems = this.subItemsArray(itemIndex);
    const subIndex = subItems.controls.indexOf(subControl);
    if (subIndex === -1) {
      return;
    }
    subItems.removeAt(subIndex);
    this.#cdr.markForCheck();
  }

  setSubItemColor(itemIndex: number, subIndex: number, color: TodoSubItemColor): void {
    this.subItemsArray(itemIndex).at(subIndex).get('color')?.setValue(color);
    this.#cdr.markForCheck();
  }

  colorLabel(color: TodoSubItemColor): string {
    return `todos.color${color.charAt(0).toUpperCase()}${color.slice(1)}`;
  }

  savedTodoItems(): TodoItem[] {
    return this.#projectStore.project()?.todo_items ?? this.todoItems() ?? [];
  }

  canAssign(): boolean {
    return this.savedTodoItems().length > 0 && this.objects().length > 0;
  }

  private buildItemsPayload(): {
    id: string | null;
    title: string;
    note: string | null;
    sub_items: { id: string | null; title: string; color: TodoSubItemColor }[];
  }[] {
    return this.itemsArray.controls.map((control) => {
      const group = control as FormGroup;
      const subItems = group.get('subItems') as FormArray;

      const sub_items = subItems.controls
        .map((subControl) => {
          const subGroup = subControl as FormGroup;
          const title = String(subGroup.get('title')?.value ?? '').trim();
          if (!title) {
            return null;
          }
          return {
            id: (subGroup.get('id')?.value as string | null) ?? null,
            title,
            color: normalizeTodoSubItemColor(String(subGroup.get('color')?.value ?? '')),
          };
        })
        .filter((sub): sub is { id: string | null; title: string; color: TodoSubItemColor } => sub !== null);

      return {
        id: (group.get('id')?.value as string | null) ?? null,
        title: String(group.get('title')?.value ?? '').trim(),
        note: String(group.get('note')?.value ?? '').trim() || null,
        sub_items,
      };
    });
  }

  save(): void {
    this.form.updateValueAndValidity({ emitEvent: false });

    const items = this.buildItemsPayload();
    const missingTitleIndex = items.findIndex((item) => !item.title);
    if (missingTitleIndex !== -1) {
      this.#expandItem(this.itemsArray.at(missingTitleIndex));
      this.#notificationService.showError(
        this.#translationService.instant('todos.itemTitleRequired'),
      );
      this.#cdr.markForCheck();
      return;
    }

    this.saving.set(true);

    this.#projectStore.updateProjectTodoItems(this.projectId(), items).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('todos.projectListUpdated'),
        );
        this.saving.set(false);
        if (this.canAssign()) {
          this.activeTab.set('assignChecklists');
          this.#cdr.markForCheck();
        } else {
          this.#modalService.close();
        }
      },
      error: (error) => {
        this.#notificationService.showError(
          error.message || this.#translationService.instant('todos.projectListUpdateFailed'),
        );
        this.saving.set(false);
      },
    });
  }

  close(): void {
    this.#modalService.close();
  }

  setTab(tab: 'items' | 'assignChecklists'): void {
    if (tab === 'assignChecklists' && !this.canAssign()) {
      this.#notificationService.showError(
        this.#translationService.instant(
          this.savedTodoItems().length ? 'todos.noObjectsToAssign' : 'todos.saveItemsBeforeAssign',
        ),
      );
      return;
    }
    this.activeTab.set(tab);
  }

  onChecklistTabIdChange(tabId: string): void {
    this.setTab(tabId as 'items' | 'assignChecklists');
    this.#cdr.markForCheck();
  }

  onAssignmentsSaved(): void {
    this.#cdr.markForCheck();
  }
}
