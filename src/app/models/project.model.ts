import { ProjectPhotoSubGroup } from './file.model';
import { ProjectAddress } from './user.model';
import { WorkStatus } from './status.model';
import { Object } from './object.model';
import { ProtocolRecord } from './protocol.model';
import { TodoItem } from './todo.model';
import type { NoteLine } from './note-line.model';

/** Uploaded street plan image — interactive map for object pins. */
export interface StreetPlan {
  path: string;
  updated_at?: string;
}

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
  photo_sub_groups?: ProjectPhotoSubGroup[];
  todo_items?: TodoItem[];
  checklist_note?: string;
  checklist_note_lines?: NoteLine[];
  archived_at?: string;
  archive_comment?: string;
  deleted_at?: string;
  created_at?: string;
  street_plan?: StreetPlan;
}
