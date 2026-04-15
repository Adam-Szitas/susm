import type { MongoDateJson } from './mongo-date';

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
  category?: string;
  note?: string;
  files: FileGroupItem[];
  created_at?: MongoDateJson;
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

