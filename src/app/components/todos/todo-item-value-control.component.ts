import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import {
  getObjectTodoStatus,
  getSelectedSubItem,
  getSelectedSubItemId,
  getSubItems,
  hasSubItems,
  ObjectTodoEntry,
  normalizeTodoSubItemColor,
  TodoItem,
  TodoItemStatus,
  TodoSubItem,
  TodoSubItemColor,
  todoItemId,
  todoSubItemId,
  updateSelectedSubItem,
  updateTodoEntryStatus,
} from '@models';

/** Inline status / sub-item editor for a single checklist on one object. */
@Component({
  selector: 'app-todo-item-value-control',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './todo-item-value-control.component.html',
  styleUrl: './todo-item-value-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodoItemValueControlComponent {
  item = input.required<TodoItem>();
  entries = input.required<ObjectTodoEntry[]>();
  disabled = input(false);

  entriesChange = output<ObjectTodoEntry[]>();

  readonly todoSubItemId = todoSubItemId;

  itemHasSubItems(item: TodoItem): boolean {
    return hasSubItems(item);
  }

  subItems(item: TodoItem): TodoSubItem[] {
    return getSubItems(item);
  }

  itemStatus(item: TodoItem): TodoItemStatus | null {
    return getObjectTodoStatus(this.entries(), todoItemId(item));
  }

  selectedSubItemId(item: TodoItem): string | null {
    return getSelectedSubItemId(this.entries(), todoItemId(item));
  }

  selectedSubColor(item: TodoItem): TodoSubItemColor {
    const sub = getSelectedSubItem(this.entries(), item);
    return normalizeTodoSubItemColor(sub?.color);
  }

  setStatus(item: TodoItem, status: TodoItemStatus): void {
    const entries = updateTodoEntryStatus(this.entries(), todoItemId(item), status);
    this.entriesChange.emit(entries);
  }

  setSelectedSubItem(item: TodoItem, subItemId: string): void {
    const entries = updateSelectedSubItem(this.entries(), item, subItemId);
    this.entriesChange.emit(entries);
  }
}
