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
  from_date?: string;
  to_date?: string;
  file_group_categories?: string[];
  custom_object_order?: boolean;
  /** When false, checklist sections were omitted from this protocol PDF. */
  include_checklists?: boolean;
  /** When true, each file group started on a new page in this protocol PDF. */
  file_group_on_new_page?: boolean;
  /** Checklist item ids excluded from this protocol PDF. */
  excluded_checklist_item_ids?: string[];
  /** Checklist sections captured when this protocol was saved. */
  todo_sections_snapshot?: ProtocolTodoSectionSnapshot[];
  /** Per-object file group order captured when this protocol was saved. */
  object_file_layouts?: Record<string, ProtocolObjectFileLayout>;
  /** Older protocol IDs merged after this one in the PDF (stored order). */
  linked_protocol_ids?: string[];
}

/** True when the protocol row came from a user PDF upload (not template generation). */
export function isUploadedProtocol(protocol: ProtocolRecord): boolean {
  return !!protocol.uploaded_pdf_path?.trim();
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
  /** When true, add this PDF to the project's Generated Protocols list (default: download only). */
  save_to_project?: boolean;
  /** When true, `object_ids` order is used as the protocol object order. */
  custom_object_order?: boolean;
  /** When false, project checklist sections are omitted from preview/PDF and TOC. */
  include_checklists?: boolean;
  /** When true, each file group begins on a new protocol page. */
  file_group_on_new_page?: boolean;
  /** Checklist item ids to omit from preview/PDF. */
  excluded_checklist_item_ids?: string[];
}

export interface ProtocolTodoLineSnapshot {
  label: string;
  object_names: string[];
  color?: string;
}

export interface ProtocolTodoSectionSnapshot {
  title: string;
  note?: string;
  lines: ProtocolTodoLineSnapshot[];
}

export interface ProtocolObjectFileLayout {
  group_ids: string[];
  file_ids_by_group?: Record<string, string[]>;
  sub_group_ids_by_group?: Record<string, string[]>;
  file_ids_by_sub_group?: Record<string, string[]>;
}
