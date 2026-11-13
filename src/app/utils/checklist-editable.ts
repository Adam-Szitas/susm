/** Presentation decorations never become part of saved note text or UTF-16 offsets. */
export interface EditableSelection {
  start: number;
  end: number;
  backward?: boolean;
}

const blocks = new Set(['DIV', 'P', 'LI']);

export function editableText(root: Node): string {
  if (root.nodeType === Node.TEXT_NODE) return root.nodeValue ?? '';
  const element = root.nodeType === Node.ELEMENT_NODE ? (root as Element) : null;
  if (element?.hasAttribute('data-decoration')) return '';
  if (element?.tagName === 'BR') return '\n';
  const children = [...root.childNodes].filter(
    (node) =>
      node.nodeType !== Node.ELEMENT_NODE || !(node as Element).hasAttribute('data-decoration'),
  );
  const block = (node: Node) =>
    node.nodeType === Node.ELEMENT_NODE && blocks.has((node as Element).tagName);
  return children
    .map((child, index) => {
      const separator = index > 0 && (block(child) || block(children[index - 1])) ? '\n' : '';
      // Browsers leave a final BR as the empty-line caret placeholder.
      const placeholder =
        index === children.length - 1 &&
        child.nodeType === Node.ELEMENT_NODE &&
        (child as Element).tagName === 'BR';
      return separator + (placeholder ? '' : editableText(child));
    })
    .join('');
}

export function editableSelection(root: HTMLElement): EditableSelection | null {
  const selection = root.ownerDocument.getSelection();
  if (
    !selection?.anchorNode ||
    !selection.focusNode ||
    !root.contains(selection.anchorNode) ||
    !root.contains(selection.focusNode)
  )
    return null;
  const offset = (node: Node, index: number) => {
    const range = root.ownerDocument.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, index);
    return editableText(range.cloneContents()).length;
  };
  const anchor = offset(selection.anchorNode, selection.anchorOffset);
  const focus = offset(selection.focusNode, selection.focusOffset);
  return { start: Math.min(anchor, focus), end: Math.max(anchor, focus), backward: anchor > focus };
}

/** Restore selection after repainting canonical rows, without selecting the dash decorations. */
export function restoreEditableSelection(root: HTMLElement, selection: EditableSelection): void {
  const rows = [...root.querySelectorAll<HTMLElement>('[data-editor-row]')];
  const point = (offset: number): [Node, number] => {
    let remaining = Math.max(0, offset);
    for (const [index, row] of rows.entries()) {
      const length = editableText(row).length;
      if (remaining <= length || index === rows.length - 1) {
        const walker = root.ownerDocument.createTreeWalker(row, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) =>
            node.parentElement?.closest('[data-decoration]')
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_ACCEPT,
        });
        let text: Node | null;
        while ((text = walker.nextNode())) {
          const size = text.nodeValue?.length ?? 0;
          if (remaining <= size) return [text, remaining];
          remaining -= size;
        }
        return [row, length === 0 ? 0 : row.childNodes.length];
      }
      remaining -= length + 1;
    }
    return [root, 0];
  };
  const start = point(selection.start);
  const end = point(selection.end);
  const native = root.ownerDocument.getSelection();
  if (selection.backward) native?.setBaseAndExtent(...end, ...start);
  else native?.setBaseAndExtent(...start, ...end);
}
