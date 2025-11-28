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
  description?: string;
  created_at: string;
}

export type FileUploadTarget = 'object' | 'project';

