export type TodoItemStatus = 'under_process' | 'finished';

export type TodoSubItemColor = 'red' | 'blue' | 'green' | 'orange';

export type ObjectTodoAggregateStatus = 'none' | 'complete' | 'attention';

export type ObjectTodoCardAppearance =
  | { kind: 'none' }
  | { kind: 'sub-color'; color: TodoSubItemColor }
  | { kind: 'aggregate'; status: 'complete' | 'attention' };

export const TODO_SUB_ITEM_COLORS: TodoSubItemColor[] = ['red', 'blue', 'green', 'orange'];

export interface TodoSubItem {
  _id: { $oid: string };
  title: string;
  color: TodoSubItemColor;
  sort_order: number;
}

export interface TodoItem {
  _id: { $oid: string };
  title: string;
  note?: string;
  sort_order: number;
  sub_items?: TodoSubItem[];
}

export interface ObjectTodoEntry {
  todo_item_id: { $oid: string } | string;
  todo_sub_item_id?: { $oid: string } | string | null;
  status: TodoItemStatus | string;
}

export function safeTodoItemId(item: Pick<TodoItem, '_id'> | null | undefined): string {
  const id = item?._id as { $oid?: string } | string | undefined;
  if (!id) return '';
  if (typeof id === 'string') return id;
  return id.$oid ?? '';
}

export function safeTodoSubItemId(sub: Pick<TodoSubItem, '_id'> | null | undefined): string {
  const id = sub?._id as { $oid?: string } | string | undefined;
  if (!id) return '';
  if (typeof id === 'string') return id;
  return id.$oid ?? '';
}

export function todoItemId(item: TodoItem): string {
  return safeTodoItemId(item);
}

export function todoSubItemId(sub: TodoSubItem): string {
  return safeTodoSubItemId(sub);
}

export function resolveAssignedTodoItems(
  todoItems: TodoItem[],
  entries: ObjectTodoEntry[] | undefined,
): TodoItem[] {
  if (!entries?.length || !todoItems.length) {
    return [];
  }

  const assignedParentIds = new Set(entries.map((entry) => todoEntryItemId(entry)));
  return sortTodoItems(todoItems).filter((item) => {
    const parentId = safeTodoItemId(item);
    return !!parentId && assignedParentIds.has(parentId);
  });
}

export function todoEntryItemId(entry: ObjectTodoEntry): string {
  if (typeof entry.todo_item_id === 'string') {
    return entry.todo_item_id;
  }
  return entry.todo_item_id.$oid;
}

export function todoEntrySubItemId(entry: ObjectTodoEntry): string | null {
  const value = entry.todo_sub_item_id;
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.$oid;
}

export function sortTodoItems(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

export function sortTodoSubItems(items: TodoSubItem[]): TodoSubItem[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

export function getSubItems(item: TodoItem): TodoSubItem[] {
  return sortTodoSubItems(item.sub_items ?? []);
}

export function hasSubItems(item: TodoItem): boolean {
  return getSubItems(item).length > 0;
}

export function computeObjectTodoAggregateStatus(
  entries: ObjectTodoEntry[] | undefined,
): ObjectTodoAggregateStatus {
  if (!entries?.length) {
    return 'none';
  }

  const plainEntries = entries.filter((entry) => !todoEntrySubItemId(entry));
  if (!plainEntries.length) {
    return 'none';
  }

  if (plainEntries.every((e) => normalizeTodoItemStatus(e.status) === 'finished')) {
    return 'complete';
  }
  return 'attention';
}

export function computeObjectTodoCardAppearance(
  entries: ObjectTodoEntry[] | undefined,
  todoItems: TodoItem[] | undefined,
): ObjectTodoCardAppearance {
  if (!entries?.length || !todoItems?.length) {
    return { kind: 'none' };
  }

  for (const item of sortTodoItems(todoItems)) {
    if (!hasSubItems(item) || !isParentTodoAssigned(entries, todoItemId(item))) {
      continue;
    }
    const sub = getSelectedSubItem(entries, item);
    if (sub) {
      return { kind: 'sub-color', color: normalizeTodoSubItemColor(sub.color) };
    }
  }

  const aggregate = computeObjectTodoAggregateStatus(entries);
  if (aggregate === 'complete') {
    return { kind: 'aggregate', status: 'complete' };
  }
  if (aggregate === 'attention') {
    return { kind: 'aggregate', status: 'attention' };
  }
  return { kind: 'none' };
}

export function objectTodoCardClassNames(
  entries: ObjectTodoEntry[] | undefined,
  todoItems: TodoItem[] | undefined,
): string[] {
  const appearance = computeObjectTodoCardAppearance(entries, todoItems);
  if (appearance.kind === 'sub-color') {
    return [`card--todo-sub-${appearance.color}`];
  }
  if (appearance.kind === 'aggregate' && appearance.status === 'complete') {
    return ['card--todo-complete'];
  }
  if (appearance.kind === 'aggregate' && appearance.status === 'attention') {
    return ['card--todo-attention'];
  }
  return [];
}

export function normalizeTodoItemStatus(status: string): TodoItemStatus {
  if (status === 'finished' || status === 'successful') {
    return 'finished';
  }
  return 'under_process';
}

export function normalizeTodoSubItemColor(color: string | undefined): TodoSubItemColor {
  if (color === 'blue' || color === 'green' || color === 'orange') {
    return color;
  }
  return 'red';
}

export function isParentTodoAssigned(
  entries: ObjectTodoEntry[] | undefined,
  parentId: string,
): boolean {
  return entries?.some((entry) => todoEntryItemId(entry) === parentId) ?? false;
}

export function isTodoAssigned(
  entries: ObjectTodoEntry[] | undefined,
  todoItemIdValue: string,
): boolean {
  return isParentTodoAssigned(entries, todoItemIdValue);
}

export function getSelectedSubItemId(
  entries: ObjectTodoEntry[] | undefined,
  parentId: string,
): string | null {
  const entry = entries?.find(
    (e) => todoEntryItemId(e) === parentId && !!todoEntrySubItemId(e),
  );
  return entry ? todoEntrySubItemId(entry) : null;
}

export function getSelectedSubItem(
  entries: ObjectTodoEntry[] | undefined,
  item: TodoItem,
): TodoSubItem | null {
  const selectedId = getSelectedSubItemId(entries, todoItemId(item));
  if (!selectedId) return null;
  return getSubItems(item).find((sub) => todoSubItemId(sub) === selectedId) ?? null;
}

export function getObjectTodoStatus(
  entries: ObjectTodoEntry[] | undefined,
  todoItemIdValue: string,
): TodoItemStatus | null {
  const entry = entries?.find((e) => {
    if (todoEntryItemId(e) !== todoItemIdValue) return false;
    return !todoEntrySubItemId(e);
  });
  return entry ? normalizeTodoItemStatus(entry.status) : null;
}

export function entriesForAssignedParent(
  item: TodoItem,
  existing: ObjectTodoEntry[],
): ObjectTodoEntry[] {
  const parentId = todoItemId(item);
  const withoutParent = existing.filter((entry) => todoEntryItemId(entry) !== parentId);
  const subs = getSubItems(item);

  if (subs.length === 0) {
    const previous = existing.find(
      (entry) => todoEntryItemId(entry) === parentId && !todoEntrySubItemId(entry),
    );
    return [
      ...withoutParent,
      {
        todo_item_id: parentId,
        status: previous ? normalizeTodoItemStatus(previous.status) : 'under_process',
      },
    ];
  }

  const previous = existing.find((entry) => todoEntryItemId(entry) === parentId);
  const previousSubId = previous ? todoEntrySubItemId(previous) : null;
  const validSubId =
    previousSubId && subs.some((sub) => todoSubItemId(sub) === previousSubId)
      ? previousSubId
      : todoSubItemId(subs[0]);

  return [
    ...withoutParent,
    {
      todo_item_id: parentId,
      todo_sub_item_id: validSubId,
      status: previous ? normalizeTodoItemStatus(previous.status) : 'under_process',
    },
  ];
}

export function entriesForUnassignedParent(
  parentId: string,
  existing: ObjectTodoEntry[],
): ObjectTodoEntry[] {
  return existing.filter((entry) => todoEntryItemId(entry) !== parentId);
}

export function updateTodoEntryStatus(
  entries: ObjectTodoEntry[],
  parentId: string,
  status: TodoItemStatus,
): ObjectTodoEntry[] {
  return entries.map((entry) => {
    if (todoEntryItemId(entry) !== parentId || todoEntrySubItemId(entry)) {
      return entry;
    }
    return { ...entry, status };
  });
}

export function countAssignedTodoItems(
  entries: ObjectTodoEntry[] | undefined,
  todoItems: TodoItem[],
): { assigned: number; total: number } {
  const total = todoItems.length;
  const assigned = todoItems.filter((item) =>
    isParentTodoAssigned(entries, todoItemId(item)),
  ).length;
  return { assigned, total };
}

export function serializeTodoEntries(entries: ObjectTodoEntry[] | undefined): string {
  return JSON.stringify(entries ?? []);
}

export function updateSelectedSubItem(
  entries: ObjectTodoEntry[],
  item: TodoItem,
  subItemId: string,
): ObjectTodoEntry[] {
  const parentId = todoItemId(item);
  const withoutParent = entries.filter((entry) => todoEntryItemId(entry) !== parentId);
  const previous = entries.find((entry) => todoEntryItemId(entry) === parentId);

  return [
    ...withoutParent,
    {
      todo_item_id: parentId,
      todo_sub_item_id: subItemId,
      status: previous ? normalizeTodoItemStatus(previous.status) : 'under_process',
    },
  ];
}
