import type { ObjectAddress } from './user.model';
import type { ObjectTodoEntry, TodoItem, TodoItemStatus, TodoSubItemColor } from './todo.model';

/**
 * Checklist feedback share: time-limited public link. The URL token is the only access
 * control; the visitor email is unverified attribution and must never be presented as login.
 */
export type ChecklistFeedbackShareStatus = 'open' | 'expired' | 'revoked';
export type ChecklistFeedbackSubmissionStatus = 'pending' | 'accepted' | 'rejected';
export type ChecklistFeedbackLocale = 'en' | 'de' | 'sk';

export interface ChecklistFeedbackShare {
  id: string;
  token: string;
  url: string;
  expires_at: string;
  created_at: string;
  label?: string;
  status: ChecklistFeedbackShareStatus;
  todo_item_ids: string[];
  pending_count: number;
}

export interface ChecklistFeedbackReviewRow {
  object_id: string;
  object_address?: ObjectAddress;
  object_prefix?: string;
  todo_item_id: string;
  checklist_title: string;
  proposed_status?: TodoItemStatus;
  proposed_sub_item_title?: string;
  proposed_sub_item_color?: TodoSubItemColor;
  note_text?: string;
  baseline_status?: TodoItemStatus;
  baseline_sub_item_title?: string;
  current_status?: TodoItemStatus;
  current_sub_item_title?: string;
  current_sub_item_color?: TodoSubItemColor;
  still_assigned: boolean;
}

export interface ChecklistFeedbackSubmission {
  id: string;
  share_id: string;
  share_label?: string;
  project_id: string;
  project_name: string;
  /** Claimed by the visitor, not verified. */
  submitter_email: string;
  submitted_at: string;
  status: ChecklistFeedbackSubmissionStatus;
  reviewed_at?: string;
  reviewed_by_email?: string;
  rows: ChecklistFeedbackReviewRow[];
}

export interface ChecklistFeedbackAcceptResult {
  submission: ChecklistFeedbackSubmission;
  applied: number;
  skipped: { object_id: string; todo_item_id: string }[];
  already_accepted: boolean;
}

// ---------------------------------------------------------------------------
// Public page
// ---------------------------------------------------------------------------

export interface PublicFeedbackGate {
  status: 'open';
  locale: ChecklistFeedbackLocale;
  project_name: string;
  expires_at: string;
  checklist_count: number;
}

export interface PublicFeedbackGone {
  error: string;
  status: Exclude<ChecklistFeedbackShareStatus, 'open'>;
  locale: ChecklistFeedbackLocale;
}

export interface PublicFeedbackSession {
  session_token: string;
  session_expires_at: number;
  email: string;
}

export interface PublicFeedbackNote {
  id: string;
  body: string;
  created_at: string;
}

export interface PublicFeedbackObjectRow {
  object_id: string;
  address: ObjectAddress;
  prefix?: string;
  status: TodoItemStatus;
  todo_sub_item_id?: string;
  my_notes: PublicFeedbackNote[];
}

export interface PublicFeedbackChecklist {
  id: string;
  title: string;
  note?: string;
  sub_items: { id: string; title: string; color: TodoSubItemColor }[];
  objects: PublicFeedbackObjectRow[];
}

export interface PublicFeedbackView {
  locale: ChecklistFeedbackLocale;
  project_name: string;
  expires_at: string;
  email: string;
  checklists: PublicFeedbackChecklist[];
}

export interface PublicFeedbackChange {
  object_id: string;
  todo_item_id: string;
  status?: TodoItemStatus;
  todo_sub_item_id?: string;
  note_text?: string;
}

/** Local edit state for one object/checklist row on the public page. */
export interface PublicFeedbackDraft {
  status: TodoItemStatus;
  todoSubItemId: string | null;
  note: string;
}

export function feedbackRowKey(objectId: string, todoItemId: string): string {
  return `${objectId}:${todoItemId}`;
}

export function baselineDraft(row: PublicFeedbackObjectRow): PublicFeedbackDraft {
  return {
    status: row.status === 'finished' ? 'finished' : 'under_process',
    todoSubItemId: row.todo_sub_item_id ?? null,
    note: '',
  };
}

/** Which fields differ from the loaded baseline (drives the dirty flags). */
export function draftDirtyFields(
  baseline: PublicFeedbackDraft,
  draft: PublicFeedbackDraft | undefined,
): { status: boolean; note: boolean } {
  if (!draft) return { status: false, note: false };
  return {
    status:
      draft.status !== baseline.status || (draft.todoSubItemId ?? null) !== baseline.todoSubItemId,
    note: draft.note.trim().length > 0,
  };
}

/** Builds the submit payload from drafts; only changed fields are sent. */
export function buildFeedbackChanges(
  checklists: PublicFeedbackChecklist[],
  drafts: ReadonlyMap<string, PublicFeedbackDraft>,
): PublicFeedbackChange[] {
  const changes: PublicFeedbackChange[] = [];
  for (const checklist of checklists) {
    const hasSubs = checklist.sub_items.length > 0;
    for (const row of checklist.objects) {
      const baseline = baselineDraft(row);
      const draft = drafts.get(feedbackRowKey(row.object_id, checklist.id));
      const dirty = draftDirtyFields(baseline, draft);
      if (!draft || (!dirty.status && !dirty.note)) continue;
      const change: PublicFeedbackChange = { object_id: row.object_id, todo_item_id: checklist.id };
      if (dirty.status) {
        if (hasSubs) {
          if (draft.todoSubItemId) change.todo_sub_item_id = draft.todoSubItemId;
        } else {
          change.status = draft.status;
        }
      }
      if (dirty.note) change.note_text = draft.note.trim();
      if (change.status || change.todo_sub_item_id || change.note_text) changes.push(change);
    }
  }
  return changes;
}

/** Adapts a public checklist to the in-app `TodoItem` shape so shared controls can render it. */
export function publicChecklistAsTodoItem(checklist: PublicFeedbackChecklist): TodoItem {
  return {
    _id: { $oid: checklist.id },
    title: checklist.title,
    note: checklist.note,
    sort_order: 0,
    sub_items: checklist.sub_items.map((sub, index) => ({
      _id: { $oid: sub.id },
      title: sub.title,
      color: sub.color,
      sort_order: index,
    })),
  };
}

export function draftAsTodoEntries(checklistId: string, draft: PublicFeedbackDraft): ObjectTodoEntry[] {
  return [
    {
      todo_item_id: checklistId,
      todo_sub_item_id: draft.todoSubItemId,
      status: draft.status,
    },
  ];
}

export function isValidAttributionEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 254 || /\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}
