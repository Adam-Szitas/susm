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
  /** Shown under the template name on the PDF cover page. */
  subtitle?: string;
  description?: string;
  fields: ProtocolField[];
  header_template?: string;
  footer_template?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProtocolTemplate {
  name: string;
  subtitle?: string;
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
  /** Present when the PDF was uploaded by the user rather than generated from a template. */
  uploaded_pdf_path?: string;
}

export interface GenerateProtocolRequest {
  template_id: string;
  project_id: string;
  object_ids: string[];
  data?: Record<string, unknown>;
  from_date?: string;
  to_date?: string;
  /** When set, only file groups whose categories intersect these labels appear in preview/PDF. */
  file_group_categories?: string[];
  /** Optional: include these older protocol IDs in the same PDF (older first, then new content). */
  linked_protocol_ids?: string[];
}
