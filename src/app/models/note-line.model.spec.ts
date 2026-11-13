import { NoteLine, noteRows, rebaseNoteLines, selectedNoteLines } from './note-line.model';

describe('checklist note paragraph identities', () => {
  const mark: NoteLine = { id: 'repair', line: 1, text: 'Opraviť 🚪', checklist: true };

  it('keeps the same mark when a paragraph is edited or preceding paragraphs are inserted', () => {
    expect(rebaseNoteLines('Note\nOpraviť 🚪', 'Note\nOpraviť okno', [mark])).toEqual([
      { ...mark, text: 'Opraviť okno' },
    ]);
    expect(rebaseNoteLines('Note\nOpraviť 🚪', 'New\nNote\nOpraviť 🚪', [mark])).toEqual([
      { ...mark, line: 2 },
    ]);
  });

  it('drops removed paragraphs and ignores stale formatting instead of marking unrelated text', () => {
    expect(rebaseNoteLines('Note\nOpraviť 🚪', 'Note', [mark])).toEqual([]);
    expect(noteRows('Note\nOther', [mark])[1].format).toBeUndefined();
  });

  it('does not include the next paragraph when a selection ends at its beginning', () => {
    expect(selectedNoteLines('First\nSecond\nThird', 0, 6)).toEqual([0]);
    expect(selectedNoteLines('First\n\nThird', 0, 12)).toEqual([0, 2]);
    expect(selectedNoteLines('First\nSecond', 7, 7)).toEqual([1]);
  });

  it('keeps separate marked passages and shifts their ranges when text is inserted before them', () => {
    const marks: NoteLine[] = [
      { id: 'door', line: 0, text: 'Repair door and window', start: 0, end: 11, checklist: true },
      {
        id: 'window',
        line: 0,
        text: 'Repair door and window',
        start: 16,
        end: 22,
        checklist: true,
      },
    ];
    expect(noteRows('Repair door and window', marks)[0].parts).toEqual([
      { text: 'Repair door', marked: true },
      { text: ' and ', marked: false },
      { text: 'window', marked: true },
    ]);
    const shifted = rebaseNoteLines(
      'Repair door and window',
      'Please Repair door and window',
      marks,
    );
    expect(shifted.map((mark) => [mark.id, mark.start, mark.end])).toEqual([
      ['door', 7, 18],
      ['window', 23, 29],
    ]);
  });

  it('keeps paired identities for contained edits and drops notes when their title is deleted', () => {
    const text = 'Door\nCheck lock';
    const formats: NoteLine[] = [
      { id: 'title', group_id: 'pair', line: 0, text: 'Door', start: 0, end: 4, checklist: true },
      {
        id: 'note',
        group_id: 'pair',
        line: 1,
        text: 'Check lock',
        start: 0,
        end: 10,
        checklist: true,
        checklist_note: true,
      },
    ];
    const updated = rebaseNoteLines(text, 'Doors\nCheck lock', formats);
    // Text inserted at the end of the selection stays outside it; contained edits stay linked.
    expect(updated[0].group_id).toBe('pair');
    const replaced = rebaseNoteLines(text, 'Gate\nCheck lock', formats);
    expect(replaced[0]).toEqual({ ...formats[0], text: 'Gate' });
    expect(replaced[1]).toEqual(formats[1]);
    expect(rebaseNoteLines(text, 'Check lock', formats)).toEqual([]);
    expect(noteRows(text, formats)[1].parts[0]).toEqual({
      text: 'Check lock',
      marked: true,
      note: true,
    });
  });
});
