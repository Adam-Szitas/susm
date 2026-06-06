import { ProjectAddress } from './user.model';
import { WorkStatus } from './status.model';
import { Object } from './object.model';
import { ProtocolRecord } from './protocol.model';
import { TodoItem } from './todo.model';

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
  todo_items?: TodoItem[];
  archived_at?: string;
  archive_comment?: string;
  deleted_at?: string;
  created_at?: string;
}
