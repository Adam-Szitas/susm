export type FieldType = 'text' | 'number' | 'date' | 'address' | 'status' | 'note' | 'custom';

export interface ProtocolField {
  label: string;
  field_type: FieldType;
  required: boolean;
  order: number;
}

export interface ProtocolTemplate {
  _id?: { $oid: string };
  name: string;
  description?: string;
  fields: ProtocolField[];
  header_template?: string;
  footer_template?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProtocolTemplate {
  name: string;
  description?: string;
  fields: ProtocolField[];
  header_template?: string;
  footer_template?: string;
}

export interface ProtocolRecord {
  _id: { $oid: string };
  template_id: { $oid: string };
  template_name: string;
  project_id: { $oid: string };
  object_ids: { $oid: string }[];
  object_names: string[];
  generated_at: string;
  generated_by: string;
  data?: Record<string, unknown>;
}

export interface GenerateProtocolRequest {
  template_id: string;
  project_id: string;
  object_ids: string[];
  data?: Record<string, unknown>;
}

