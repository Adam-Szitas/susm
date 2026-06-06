export type TodoItemStatus = 'pending' | 'successful' | 'failed';

export type ObjectTodoAggregateStatus = 'none' | 'complete' | 'attention';

export interface TodoItem {
  _id: { $oid: string };
  title: string;
  note?: string;
  sort_order: number;
}

export interface ObjectTodoEntry {
  todo_item_id: { $oid: string } | string;
  status: TodoItemStatus;
}

export function todoItemId(item: TodoItem): string {
  return item._id.$oid;
}

export function todoEntryItemId(entry: ObjectTodoEntry): string {
  if (typeof entry.todo_item_id === 'string') {
    return entry.todo_item_id;
  }
  return entry.todo_item_id.$oid;
}

export function sortTodoItems(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

export function computeObjectTodoAggregateStatus(
  entries: ObjectTodoEntry[] | undefined,
): ObjectTodoAggregateStatus {
  if (!entries?.length) {
    return 'none';
  }
  if (entries.every((e) => e.status === 'successful')) {
    return 'complete';
  }
  return 'attention';
}

export function getObjectTodoStatus(
  entries: ObjectTodoEntry[] | undefined,
  todoItemIdValue: string,
): TodoItemStatus | null {
  const entry = entries?.find((e) => todoEntryItemId(e) === todoItemIdValue);
  return entry?.status ?? null;
}

export function isTodoAssigned(
  entries: ObjectTodoEntry[] | undefined,
  todoItemIdValue: string,
): boolean {
  return entries?.some((e) => todoEntryItemId(e) === todoItemIdValue) ?? false;
}
