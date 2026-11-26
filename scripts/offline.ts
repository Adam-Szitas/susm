import { checklistDrafts, writeDraft } from '../src/app/utils/checklist-drafts';
import { rebaseNoteLines, pruneChecklistNotes } from '../src/app/models/note-line.model';

const projects = document.querySelector<HTMLSelectElement>('#projects')!;
const note = document.querySelector<HTMLTextAreaElement>('#note')!;
const status = document.querySelector<HTMLElement>('#status')!;
document.querySelector<HTMLButtonElement>('#retry')!.onclick = () => location.assign('/projects');
const activeUser = localStorage.getItem('user');
window.addEventListener('storage', (event) => {
  if (
    event.key === null ||
    event.key === 'susm.checklist-device' ||
    (event.key === 'token' && !event.newValue) ||
    (event.key === 'user' && event.newValue !== activeUser)
  )
    location.reload();
});
async function start() {
  const drafts = await checklistDrafts();
  if (!drafts.length) {
    status.textContent = 'No checklists saved on this device.';
    return;
  }
  for (const draft of drafts) projects.add(new Option(draft.name, draft.projectId));
  document.querySelector<HTMLElement>('#drafts')!.hidden = false;
  const selected = () => drafts[projects.selectedIndex];
  projects.onchange = () => {
    note.value = selected().note;
  };
  note.value = selected().note;
  let pending = Promise.resolve();
  note.oninput = () => {
    const draft = selected();
    draft.formats = pruneChecklistNotes(rebaseNoteLines(draft.note, note.value, draft.formats));
    draft.note = note.value;
    const snapshot = { ...draft };
    status.textContent = 'Saving on this device...';
    pending = pending
      .then(async () => {
        draft.revision = await writeDraft({ ...snapshot, revision: draft.revision });
        if (draft.note === snapshot.note)
          status.textContent = 'Saved on this device. Open the project checklist online to submit.';
      })
      .catch((error) => {
        status.textContent = error.message;
      });
  };
}
start().catch(() => {
  status.textContent = 'Device storage is unavailable.';
});
