import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { TranslateModule } from '@ngx-translate/core';
import { TodoItem, todoItemId } from '@models';
import { TrashIconComponent } from '../shared/trash-icon.component';

@Component({
  selector: 'app-project-todo-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, TrashIconComponent],
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

  projectId = input.required<string>();
  todoItems = input<TodoItem[]>([]);

  form: FormGroup;
  saving = signal(false);

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
  }

  private createItemGroup(item?: TodoItem): FormGroup {
    return this.#fb.group({
      id: [item ? todoItemId(item) : null],
      title: [item?.title ?? '', [Validators.required]],
      note: [item?.note ?? ''],
    });
  }

  addItem(): void {
    const title = this.form.get('newTitle')?.value?.trim();
    if (!title) return;
    const note = this.form.get('newNote')?.value?.trim() || '';
    this.itemsArray.push(
      this.#fb.group({
        id: [null],
        title: [title, [Validators.required]],
        note: [note],
      }),
    );
    this.form.patchValue({ newTitle: '', newNote: '' });
  }

  removeItem(index: number): void {
    this.itemsArray.removeAt(index);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const items = this.itemsArray.controls.map((control) => {
      const value = control.value;
      return {
        id: value.id as string | null,
        title: value.title.trim(),
        note: value.note?.trim() || null,
      };
    });

    this.#projectStore.updateProjectTodoItems(this.projectId(), items).subscribe({
      next: () => {
        this.#notificationService.showSuccess(
          this.#translationService.instant('todos.projectListUpdated'),
        );
        this.saving.set(false);
        this.#modalService.close();
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
}
