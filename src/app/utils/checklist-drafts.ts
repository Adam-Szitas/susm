import type { NoteLine } from '../models/note-line.model';

export interface ChecklistDraft {
  projectId: string;
  name: string;
  previous: string | null;
  previousFormats: NoteLine[];
  note: string;
  formats: NoteLine[];
  revision: string;
}

const deviceKey = 'susm.checklist-device';
function device(create: boolean): string | null {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const owner = user?.uuid || user?.id || user?.email;
  if (!owner || !localStorage.getItem('token')) return null;
  const saved = JSON.parse(localStorage.getItem(deviceKey) || 'null');
  if (saved?.owner === owner) return saved.database;
  if (!create) return null;
  forgetChecklistDrafts();
  const database = 'susm-checklists-' + crypto.randomUUID();
  localStorage.setItem(deviceKey, JSON.stringify({ owner, database }));
  return database;
}

export function hasChecklistDrafts(): boolean {
  try {
    return !!device(false);
  } catch {
    return false;
  }
}

export function forgetChecklistDrafts(): void {
  const saved = localStorage.getItem(deviceKey);
  localStorage.removeItem(deviceKey);
  if (saved) indexedDB.deleteDatabase(JSON.parse(saved).database);
}

async function openDrafts(create: boolean): Promise<IDBDatabase | null> {
  const name = device(create);
  if (!name) return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('drafts', { keyPath: 'projectId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function checklistDrafts(): Promise<ChecklistDraft[]> {
  const db = await openDrafts(false);
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const req = db.transaction('drafts').objectStore('drafts').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    db.close();
  });
}

// Compare within the write transaction so two tabs cannot overwrite each other's edits.
export async function writeDraft(draft: ChecklistDraft, remove = false): Promise<string> {
  const db = await openDrafts(!draft.revision);
  if (!db) throw Error('Sign in again to save this draft.');
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite');
    const store = tx.objectStore('drafts');
    const read = store.get(draft.projectId);
    const revision = crypto.randomUUID();
    read.onsuccess = () => {
      if ((read.result?.revision ?? '') !== draft.revision) {
        tx.abort();
        return;
      }
      if (remove) store.delete(draft.projectId);
      else store.put({ ...draft, revision });
    };
    tx.oncomplete = () => resolve(revision);
    tx.onabort = () =>
      reject(tx.error || Error('Draft changed in another window. Reopen it to review.'));
    db.close();
  });
}
