/** Formatting is stored separately so notes remain readable as plain text everywhere. */
export interface NoteLine {
  id: string;
  /** All passages from one selection create one checklist, including across newlines. */
  group_id?: string;
  line: number;
  text: string;
  bold?: boolean;
  bullet?: boolean;
  checklist?: boolean;
  /** A note passage shares its group with a title passage; absent means title (legacy). */
  checklist_note?: boolean;
  /** UTF-16 offsets within the paragraph; omitted for a whole-paragraph mark. */
  start?: number;
  end?: number;
}

export function noteRows(note: string, formats: NoteLine[]) {
  return note.split('\n').map((text, line) => {
    const parts = noteParts(
      text,
      formats.filter((f) => f.line === line && f.text === text && f.checklist),
    );
    return {
      text,
      format:
        formats.find((f) => f.line === line && f.text === text && f.bullet) ??
        formats.find((f) => f.line === line && f.text === text),
      parts,
      hasNote: parts.some((part) => part.note),
    };
  });
}

function noteParts(text: string, marks: NoteLine[]) {
  const parts: { text: string; marked: boolean; note?: boolean }[] = [];
  let cursor = 0;
  for (const mark of [...marks].sort((a, b) => (a.start ?? 0) - (b.start ?? 0))) {
    const start = Math.max(cursor, mark.start ?? 0);
    const end = Math.min(text.length, mark.end ?? text.length);
    if (end <= start) continue;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), marked: false });
    parts.push({
      text: text.slice(start, end),
      marked: true,
      ...(mark.checklist_note ? { note: true } : {}),
    });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), marked: false });
  return parts.length ? parts : [{ text: text || '\u200b', marked: false }];
}

/** Preserve identities for edited paragraphs; shift unchanged paragraphs after insertions. */
export function rebaseNoteLines(before: string, after: string, formats: NoteLine[]): NoteLine[] {
  const oldRows = before.split('\n');
  const newRows = after.split('\n');
  let prefix = 0;
  while (prefix < oldRows.length && prefix < newRows.length && oldRows[prefix] === newRows[prefix])
    prefix++;
  let suffix = 0;
  while (
    suffix < oldRows.length - prefix &&
    suffix < newRows.length - prefix &&
    oldRows[oldRows.length - 1 - suffix] === newRows[newRows.length - 1 - suffix]
  )
    suffix++;
  const sameCount = oldRows.length === newRows.length;
  return pruneChecklistNotes(
    formats.flatMap((format) => {
      if (oldRows[format.line] !== format.text) return [];
      let line = format.line;
      if (line >= oldRows.length - suffix) line += newRows.length - oldRows.length;
      else if (line >= prefix && !sameCount) return [];
      const text = newRows[line];
      if (!text?.trim()) return [];
      if (format.start != null && format.end != null && text !== format.text) {
        let prefix = 0;
        while (
          prefix < text.length &&
          prefix < format.text.length &&
          text[prefix] === format.text[prefix]
        )
          prefix++;
        let suffix = 0;
        while (
          suffix < text.length - prefix &&
          suffix < format.text.length - prefix &&
          text[text.length - suffix - 1] === format.text[format.text.length - suffix - 1]
        )
          suffix++;
        const oldEnd = format.text.length - suffix;
        const delta = text.length - format.text.length;
        if (oldEnd <= format.start)
          return [{ ...format, line, text, start: format.start + delta, end: format.end + delta }];
        if (prefix < format.end) {
          // Keep the checklist identity for edits contained within its marked passage.
          // Edits spanning its boundary are ambiguous and must be marked again.
          if (prefix < format.start || oldEnd > format.end) return [];
          const end = format.end + delta;
          if (!text.slice(format.start, end).trim()) return [];
          return [{ ...format, line, text, end }];
        }
      }
      return [{ ...format, line, text }];
    }),
  );
}

/** Drop note passages whose title disappeared or whose range crosses another checklist. */
export function pruneChecklistNotes(formats: NoteLine[]): NoteLine[] {
  const titles = formats.filter((mark) => mark.checklist && !mark.checklist_note);
  return formats.filter((mark) => {
    if (!mark.checklist_note) return true;
    const group = mark.group_id ?? mark.id;
    const own = titles.filter((title) => (title.group_id ?? title.id) === group);
    if (!own.length) return false;
    const lastLine = Math.max(...own.map((title) => title.line));
    const nearest = titles
      .filter((title) => title.line < mark.line)
      .sort((a, b) => a.line - b.line || (a.end ?? a.text.length) - (b.end ?? b.text.length))
      .at(-1);
    return (
      mark.line > lastLine &&
      (nearest?.group_id ?? nearest?.id) === group &&
      !titles.some((title) => title.line === mark.line)
    );
  });
}

export function selectedNoteLines(note: string, start: number, end: number): number[] {
  const first = note.slice(0, start).split('\n').length - 1;
  const last = note.slice(0, end > start ? end - 1 : end).split('\n').length - 1;
  return Array.from({ length: last - first + 1 }, (_, index) => first + index).filter((line) =>
    note.split('\n')[line]?.trim(),
  );
}
