import { ObjectAddress } from './user.model';
import { WorkStatus } from './status.model';

export interface Object {
  _id?: {
    $oid: string;
  };
  address: ObjectAddress;
  note: string;
  files?: File[];
  status?: WorkStatus;
  share_token?: string;
  category?: string;
  createdAt?: string;
  created_at?: string;
}

export interface ObjectWithProject {
  project_name: string;
  object: Object;
}
