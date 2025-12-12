export interface File {
  _id: {
    $oid: string;
  };
  project_id?: {
    $oid: string;
  };
  object_id?: {
    $oid: string;
  };
  path: string;
  filename: string;
  group_description?: string;
  description?: string;
  category?: string;
  group_id?: {
    $oid: string;
  };
  created_at: string;
}

export type FileUploadTarget = 'object' | 'project';

