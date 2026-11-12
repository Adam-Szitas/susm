import {
  baselineDraft,
  buildFeedbackChanges,
  draftDirtyFields,
  feedbackRowKey,
  isValidAttributionEmail,
  PublicFeedbackChecklist,
  PublicFeedbackDraft,
  publicChecklistAsTodoItem,
} from './checklist-feedback.model';

describe('checklist feedback model', () => {
  const plain: PublicFeedbackChecklist = {
    id: 'cl-plain',
    title: 'Windows',
    sub_items: [],
    objects: [
      { object_id: 'o1', address: { house_number: '1' }, status: 'under_process', my_notes: [] },
      { object_id: 'o2', address: { house_number: '1' }, status: 'finished', my_notes: [] },
    ],
  };
  const withSubs: PublicFeedbackChecklist = {
    id: 'cl-subs',
    title: 'Paint',
    sub_items: [
      { id: 's1', title: 'Red', color: 'red' },
      { id: 's2', title: 'Blue', color: 'blue' },
    ],
    objects: [{ object_id: 'o1', address: { house_number: '1' }, status: 'under_process', todo_sub_item_id: 's1', my_notes: [] }],
  };

  it('accepts any well-formed email and rejects malformed ones (format only, no verification)', () => {
    expect(isValidAttributionEmail('  Person@Example.com ')).toBeTrue();
    expect(isValidAttributionEmail('nodomain')).toBeFalse();
    expect(isValidAttributionEmail('a@b')).toBeFalse();
    expect(isValidAttributionEmail('bad email@x.com')).toBeFalse();
    expect(isValidAttributionEmail('a@@x.com')).toBeFalse();
  });

  it('flags status and note independently against the loaded baseline', () => {
    const base = baselineDraft(plain.objects[0]);
    expect(draftDirtyFields(base, undefined)).toEqual({ status: false, note: false });
    expect(draftDirtyFields(base, { ...base })).toEqual({ status: false, note: false });
    expect(draftDirtyFields(base, { ...base, status: 'finished' })).toEqual({ status: true, note: false });
    expect(draftDirtyFields(base, { ...base, note: '  ' })).toEqual({ status: false, note: false });
    expect(draftDirtyFields(base, { ...base, note: 'x' })).toEqual({ status: false, note: true });
  });

  it('sends only changed rows and fields', () => {
    const drafts = new Map<string, PublicFeedbackDraft>([
      [feedbackRowKey('o1', 'cl-plain'), { status: 'finished', todoSubItemId: null, note: ' done ' }],
      [feedbackRowKey('o2', 'cl-plain'), { status: 'finished', todoSubItemId: null, note: '' }],
      [feedbackRowKey('o1', 'cl-subs'), { status: 'under_process', todoSubItemId: 's2', note: '' }],
    ]);
    expect(buildFeedbackChanges([plain, withSubs], drafts)).toEqual([
      { object_id: 'o1', todo_item_id: 'cl-plain', status: 'finished', note_text: 'done' },
      { object_id: 'o1', todo_item_id: 'cl-subs', todo_sub_item_id: 's2' },
    ]);
    expect(buildFeedbackChanges([plain, withSubs], new Map())).toEqual([]);
  });

  it('adapts public checklists to the shared TodoItem shape', () => {
    const item = publicChecklistAsTodoItem(withSubs);
    expect(item._id.$oid).toBe('cl-subs');
    expect(item.sub_items?.map((sub) => sub._id.$oid)).toEqual(['s1', 's2']);
  });
});
