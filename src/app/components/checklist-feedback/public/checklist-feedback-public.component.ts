import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  baselineDraft,
  buildFeedbackChanges,
  draftDirtyFields,
  feedbackRowKey,
  formatObjectLabel,
  isValidAttributionEmail,
  PublicFeedbackChecklist,
  PublicFeedbackDraft,
  PublicFeedbackGate,
  PublicFeedbackObjectRow,
  PublicFeedbackView,
  TodoItemStatus,
} from '@models';
import {
  ChecklistFeedbackService,
  PublicFeedbackResult,
} from '@services/checklist-feedback.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { LocaleDatePipe } from '../../../pipes/locale-date.pipe';

type PageState = 'loading' | 'invalid' | 'gone' | 'identify' | 'editing' | 'submitted';

const SESSION_STORAGE_PREFIX = 'susm.cfb.session.';
/** Up to this many sub-items render as visible radio choices; more fall back to a select. */
const MAX_RADIO_CHOICES = 5;
/** Checklist descriptions longer than this are clamped behind "Show more". */
const LONG_DESCRIPTION_CHARS = 180;

export interface StatusChoice {
  value: TodoItemStatus;
  labelKey: string;
}

export const STATUS_CHOICES: readonly StatusChoice[] = [
  { value: 'under_process', labelKey: 'todos.statusUnderProcess' },
  { value: 'finished', labelKey: 'todos.statusFinished' },
];

interface StoredSession {
  token: string;
  email: string;
  exp: number;
}

/**
 * Public checklist feedback page. Access is the URL token; the email is a claimed,
 * unverified attribution so the project team knows who responded. Edits stay local until
 * Submit, which creates a pending proposal the link creator must accept.
 */
@Component({
  selector: 'app-checklist-feedback-public',
  standalone: true,
  imports: [FormsModule, TranslateModule, LocaleDatePipe, IconComponent],
  templateUrl: './checklist-feedback-public.component.html',
  styleUrl: './checklist-feedback-public.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistFeedbackPublicComponent implements OnInit, OnDestroy {
  protected readonly icons = icons;
  #route = inject(ActivatedRoute);
  #api = inject(ChecklistFeedbackService);
  #translation = inject(TranslationService);

  readonly state = signal<PageState>('loading');
  readonly gate = signal<PublicFeedbackGate | null>(null);
  readonly view = signal<PublicFeedbackView | null>(null);
  readonly goneStatus = signal<'expired' | 'revoked'>('expired');
  readonly email = signal('');
  readonly emailTouched = signal(false);
  readonly busy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly drafts = signal<ReadonlyMap<string, PublicFeedbackDraft>>(new Map());
  readonly lastSubmittedCount = signal(0);

  readonly emailValid = computed(() => isValidAttributionEmail(this.email()));
  readonly checklists = computed(() => this.view()?.checklists ?? []);
  readonly objectTotal = computed(() =>
    this.checklists().reduce((sum, checklist) => sum + checklist.objects.length, 0),
  );
  /** Rows whose note field was opened via "Add note". */
  readonly openNotes = signal<ReadonlySet<string>>(new Set());
  /** Checklists whose long description is expanded. */
  readonly expandedDescriptions = signal<ReadonlySet<string>>(new Set());
  readonly statusChoices = STATUS_CHOICES;
  readonly changes = computed(() => buildFeedbackChanges(this.checklists(), this.drafts()));
  readonly changeCount = computed(() => this.changes().length);
  readonly projectName = computed(() => this.view()?.project_name ?? this.gate()?.project_name ?? '');
  readonly expiresAt = computed(() => this.view()?.expires_at ?? this.gate()?.expires_at ?? null);

  #token = '';
  #session: StoredSession | null = null;
  #expiryTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.#token = this.#route.snapshot.paramMap.get('token') ?? '';
    if (!this.#token) {
      this.state.set('invalid');
      return;
    }
    this.#api.publicGate(this.#token).subscribe((result) => {
      if (!this.#handleResult(result)) return;
      if (result.kind !== 'ok') return;
      this.gate.set(result.data);
      this.#translation.setLanguageOverride(result.data.locale);
      this.#scheduleExpiry(result.data.expires_at);
      const stored = this.#readSession();
      if (stored) {
        this.#session = stored;
        this.email.set(stored.email);
        this.#loadView();
      } else {
        this.state.set('identify');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.#expiryTimer) clearTimeout(this.#expiryTimer);
    this.#translation.setLanguageOverride(null);
  }

  // -- Identify ------------------------------------------------------------

  identify(): void {
    this.emailTouched.set(true);
    if (!this.emailValid() || this.busy()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    this.#api.publicSession(this.#token, this.email().trim()).subscribe((result) => {
      this.busy.set(false);
      if (!this.#handleResult(result)) return;
      if (result.kind !== 'ok') return;
      this.#session = {
        token: result.data.session_token,
        email: result.data.email,
        exp: result.data.session_expires_at,
      };
      this.#writeSession(this.#session);
      this.email.set(result.data.email);
      this.#loadView();
    });
  }

  changeEmail(): void {
    if (this.changeCount() > 0) {
      const ok = window.confirm(this.#translation.instant('checklistFeedback.public.discardConfirm'));
      if (!ok) return;
    }
    this.#clearSession();
    this.drafts.set(new Map());
    this.view.set(null);
    this.state.set('identify');
  }

  // -- Editing -------------------------------------------------------------

  rowKey(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): string {
    return feedbackRowKey(row.object_id, checklist.id);
  }

  objectLabel(row: PublicFeedbackObjectRow): string {
    return formatObjectLabel({ address: row.address, prefix: row.prefix, _id: { $oid: row.object_id } });
  }

  draft(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): PublicFeedbackDraft {
    return this.drafts().get(this.rowKey(checklist, row)) ?? baselineDraft(row);
  }

  /** Sub-item checklists choose one sub-item; with many options a compact select is used. */
  usesSubItemSelect(checklist: PublicFeedbackChecklist): boolean {
    return checklist.sub_items.length > MAX_RADIO_CHOICES;
  }

  changedInChecklist(checklist: PublicFeedbackChecklist): number {
    return checklist.objects.filter((row) => {
      const flags = this.dirty(checklist, row);
      return flags.status || flags.note;
    }).length;
  }

  isLongDescription(checklist: PublicFeedbackChecklist): boolean {
    return (checklist.note?.length ?? 0) > LONG_DESCRIPTION_CHARS;
  }

  isDescriptionExpanded(checklist: PublicFeedbackChecklist): boolean {
    return this.expandedDescriptions().has(checklist.id);
  }

  toggleDescription(checklist: PublicFeedbackChecklist): void {
    this.expandedDescriptions.set(toggled(this.expandedDescriptions(), checklist.id));
  }

  isNoteOpen(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): boolean {
    return this.openNotes().has(this.rowKey(checklist, row)) || this.draft(checklist, row).note.length > 0;
  }

  openNote(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): void {
    const key = this.rowKey(checklist, row);
    this.openNotes.set(new Set(this.openNotes()).add(key));
    // Move focus into the field that just appeared.
    setTimeout(() => document.getElementById(this.noteFieldId(checklist, row))?.focus());
  }

  noteFieldId(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): string {
    return `cfb-note-${row.object_id}-${checklist.id}`;
  }

  setStatus(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow, status: TodoItemStatus): void {
    this.#updateDraft(checklist, row, { status });
  }

  setSubItem(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow, subItemId: string): void {
    if (!checklist.sub_items.some((sub) => sub.id === subItemId)) return;
    this.#updateDraft(checklist, row, { todoSubItemId: subItemId });
  }

  dirty(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): { status: boolean; note: boolean } {
    return draftDirtyFields(baselineDraft(row), this.drafts().get(this.rowKey(checklist, row)));
  }

  onNoteInput(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow, note: string): void {
    this.#updateDraft(checklist, row, { note });
  }

  resetRow(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): void {
    const key = this.rowKey(checklist, row);
    const next = new Map(this.drafts());
    next.delete(key);
    this.drafts.set(next);
    const notes = new Set(this.openNotes());
    notes.delete(key);
    this.openNotes.set(notes);
  }

  submit(): void {
    const changes = this.changes();
    if (!changes.length || this.busy() || !this.#session) return;
    this.busy.set(true);
    this.errorKey.set(null);
    this.#api.publicSubmit(this.#token, this.#session.token, changes).subscribe((result) => {
      this.busy.set(false);
      if (!this.#handleResult(result)) return;
      this.lastSubmittedCount.set(changes.length);
      this.drafts.set(new Map());
      this.openNotes.set(new Set());
      this.state.set('submitted');
      this.#loadView(true);
    });
  }

  continueEditing(): void {
    this.state.set('editing');
  }

  // -- Internals -----------------------------------------------------------

  #updateDraft(
    checklist: PublicFeedbackChecklist,
    row: PublicFeedbackObjectRow,
    patch: Partial<PublicFeedbackDraft>,
  ): void {
    if (this.state() !== 'editing') return;
    const key = this.rowKey(checklist, row);
    const next = new Map(this.drafts());
    next.set(key, { ...this.draft(checklist, row), ...patch });
    this.drafts.set(next);
  }

  #loadView(keepState = false): void {
    if (!this.#session) {
      this.state.set('identify');
      return;
    }
    if (!keepState) this.state.set('loading');
    this.#api.publicView(this.#token, this.#session.token).subscribe((result) => {
      if (result.kind === 'error' && (result.status === 401 || result.status === 403)) {
        this.#clearSession();
        this.state.set('identify');
        return;
      }
      if (!this.#handleResult(result)) return;
      if (result.kind !== 'ok') return;
      this.view.set(result.data);
      this.#translation.setLanguageOverride(result.data.locale);
      if (!keepState) this.state.set('editing');
    });
  }

  /** Returns false when the result ended the flow (gone / error). */
  #handleResult<T>(result: PublicFeedbackResult<T>): boolean {
    if (result.kind === 'ok') return true;
    if (result.kind === 'gone') {
      this.#translation.setLanguageOverride(result.gone.locale);
      this.goneStatus.set(result.gone.status === 'revoked' ? 'revoked' : 'expired');
      this.#clearSession();
      this.state.set('gone');
      return false;
    }
    if (result.status === 404) {
      this.state.set('invalid');
      return false;
    }
    if (result.status === 0) {
      this.errorKey.set('checklistFeedback.public.networkError');
      if (!this.gate()) this.state.set('invalid');
      return false;
    }
    this.errorKey.set(
      result.status === 400 && /too many/i.test(result.message)
        ? 'checklistFeedback.public.rateLimited'
        : 'checklistFeedback.public.genericError',
    );
    return false;
  }

  #scheduleExpiry(expiresAt: string): void {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(ms)) return;
    if (this.#expiryTimer) clearTimeout(this.#expiryTimer);
    // Lock the UI at expiry even if nothing is sent; the API enforces it independently.
    this.#expiryTimer = setTimeout(
      () => {
        this.goneStatus.set('expired');
        this.state.set('gone');
      },
      Math.max(0, Math.min(ms, 2_147_000_000)),
    );
  }

  #storageKey(): string {
    return SESSION_STORAGE_PREFIX + this.#token;
  }

  #readSession(): StoredSession | null {
    try {
      const raw = sessionStorage.getItem(this.#storageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed?.token || !parsed.email || parsed.exp * 1000 <= Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  #writeSession(session: StoredSession): void {
    try {
      sessionStorage.setItem(this.#storageKey(), JSON.stringify(session));
    } catch {
      /* private mode: session lives in memory only */
    }
  }

  #clearSession(): void {
    this.#session = null;
    try {
      sessionStorage.removeItem(this.#storageKey());
    } catch {
      /* ignore */
    }
  }
}

function toggled(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}
