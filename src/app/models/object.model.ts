import { FileGroup } from './file.model';
import { ObjectAddress } from './user.model';
import { WorkStatus } from './status.model';
import { ObjectTodoEntry } from './todo.model';

export interface Object {
  _id?: {
    $oid: string;
  };
  address: ObjectAddress;
  note: string;
  /** Present when loaded from project API — used for date-range filtering in protocol UI. */
  file_groups?: FileGroup[];
  files?: File[];
  status?: WorkStatus;
  share_token?: string;
  category?: string;
  createdAt?: string;
  created_at?: string;
  deleted_at?: string;
  prefix?: string;
  /** User-defined order within the project (lower = earlier). Omitted until first reorder. */
  sort_order?: number;
  todo_entries?: ObjectTodoEntry[];
}

/** True when any object has a saved `sort_order`. */
export function hasCustomObjectOrder(objects: Object[]): boolean {
  return objects.some((o) => o.sort_order != null);
}

/** Apply stored order when present; otherwise keep array order (default). */
export function sortObjectsByStoredOrder(objects: Object[]): Object[] {
  if (!hasCustomObjectOrder(objects)) {
    return objects;
  }
  return [...objects].sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
}

export interface ObjectWithProject {
  project_name: string;
  object: Object;
}

/**
 * Place visible IDs first (in their display order), then hidden IDs in their original order.
 */
export function packFilteredFirstOrder(fullOrder: string[], visibleOrder: string[]): string[] {
  if (visibleOrder.length === 0) {
    return fullOrder;
  }
  const visibleSet = new Set(visibleOrder);
  const hidden = fullOrder.filter((id) => !visibleSet.has(id));
  return [...visibleOrder, ...hidden];
}
