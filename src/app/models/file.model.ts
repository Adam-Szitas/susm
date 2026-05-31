import type { MongoDateJson } from './mongo-date';
import { parseMongoDateToMs } from './mongo-date';

// For object files: contains groups
export interface ObjectFile {
  _id: {
    $oid: string;
  };
  object_id: {
    $oid: string;
  };
  groups: FileGroup[];
  deleted_at?: string;
}

// For project files: simple structure without groups
export interface ProjectFile {
  _id: {
    $oid: string;
  };
  project_id: {
    $oid: string;
  };
  path: string;
  filename: string;
  description?: string;
  created_at: string;
  deleted_at?: string;
}

// Group of files within an object
export interface FileGroup {
  _id: {
    $oid: string;
  };
  description: string;
  /** One or more category labels. Legacy `category` (singular) is merged on the server. */
  categories?: string[];
  /** @deprecated Prefer `categories`; still returned for older data until migrated. */
  category?: string;
  note?: string;
  files: FileGroupItem[];
  created_at?: MongoDateJson;
  /** Present when the group was soft-deleted (`deleted_at` on the server). */
  deleted_at?: MongoDateJson;
  /** User-defined order within the object (lower = earlier). Omitted until first reorder. */
  sort_order?: number;
}

/** True when the file group is soft-deleted (`deleted_at` is a real timestamp). */
export function fileGroupIsSoftDeleted(g: Pick<FileGroup, 'deleted_at'>): boolean {
  return parseMongoDateToMs(g.deleted_at as unknown) != null;
}

/** Normalized category list for display/edit (merges legacy `category`). */
export function fileGroupCategoryLabels(g: FileGroup): string[] {
  const fromArr = (g.categories ?? []).map((s) => s?.trim() ?? '').filter(Boolean);
  if (fromArr.length > 0) {
    return [...new Set(fromArr)];
  }
  const legacy = g.category?.trim();
  return legacy ? [legacy] : [];
}

// Individual file within a group
export interface FileGroupItem {
  _id: {
    $oid: string;
  };
  path: string;
  filename: string;
  description?: string;
  sort_order?: number;
  created_at?: MongoDateJson;
  deleted_at?: MongoDateJson;
}

/** True when any active file in the group has a saved `sort_order`. */
export function hasCustomFileOrder(files: FileGroupItem[]): boolean {
  return files.some((f) => parseMongoDateToMs(f.deleted_at as unknown) == null && f.sort_order != null);
}

/** Apply stored order when present; otherwise keep array order (default). */
export function sortFileGroupItemsByStoredOrder(files: FileGroupItem[]): FileGroupItem[] {
  if (!hasCustomFileOrder(files)) {
    return files;
  }
  return files
    .map((file, index) => ({ file, index }))
    .sort((a, b) => {
      const ao = a.file.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.file.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.index - b.index;
    })
    .map(({ file }) => file);
}

/**
 * Merge a new visible-file order into the full active list.
 * Hidden files (e.g. broken thumbnails) keep their original slots.
 */
export function mergeVisibleReorderIntoFullOrder(
  fullOrder: string[],
  visibleOrderBefore: string[],
  visibleOrderAfter: string[],
): string[] {
  if (fullOrder.length === 0) return visibleOrderAfter;
  const visibleSet = new Set(visibleOrderBefore);
  const hiddenQueue = fullOrder.filter((id) => !visibleSet.has(id));
  const visibleQueue = [...visibleOrderAfter];
  return fullOrder.map((id) =>
    visibleSet.has(id) ? visibleQueue.shift()! : hiddenQueue.shift()!,
  );
}

/** True when any active group has a saved `sort_order`. */
export function hasCustomFileGroupOrder(groups: FileGroup[]): boolean {
  return groups.some(
    (g) => parseMongoDateToMs(g.deleted_at as unknown) == null && g.sort_order != null,
  );
}

/** Apply stored order when present; otherwise keep array order (default). */
export function sortFileGroupsByStoredOrder(groups: FileGroup[]): FileGroup[] {
  if (!hasCustomFileGroupOrder(groups)) {
    return groups;
  }
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const ao = a.group.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.group.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.index - b.index;
    })
    .map(({ group }) => group);
}

export type FileUploadTarget = 'object' | 'project';
