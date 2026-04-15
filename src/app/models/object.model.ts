import { FileGroup } from './file.model';
import { ObjectAddress } from './user.model';
import { WorkStatus } from './status.model';

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
}

export interface ObjectWithProject {
  project_name: string;
  object: Object;
}
