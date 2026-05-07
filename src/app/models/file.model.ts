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
}

/** True when the file group is soft-deleted (`deleted_at` is a real timestamp). */
export function fileGroupIsSoftDeleted(g: Pick<FileGroup, 'deleted_at'>): boolean {
  return parseMongoDateToMs(g.deleted_at as unknown) != null;
}

/** Normalized category list for display/edit (merges legacy `category`). */
export function fileGroupCategoryLabels(g: FileGroup): string[] {
  const fromArr = (g.categories ?? [])
    .map((s) => s?.trim() ?? '')
    .filter(Boolean);
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
  created_at?: MongoDateJson;
  deleted_at?: MongoDateJson;
}

export type FileUploadTarget = 'object' | 'project';

