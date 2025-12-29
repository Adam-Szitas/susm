import { ProjectAddress } from './user.model';
import { WorkStatus } from './status.model';
import { Object } from './object.model';
import { ProtocolRecord } from './protocol.model';

export interface Project {
  _id?: {
    $oid: string;
  };
  name: string;
  address?: ProjectAddress;
  createdAt?: string;
  inserterId?: number;
  note?: string;
  status?: WorkStatus;
  category?: string;
  categories?: string[];
  objects?: Object[];
  protocols?: ProtocolRecord[];
  archived_at?: string;
  archive_comment?: string;
  created_at?: string;
}
