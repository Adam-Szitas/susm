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
  draftAsTodoEntries,
  draftDirtyFields,
  feedbackRowKey,
  formatObjectLabel,
  isValidAttributionEmail,
  normalizeTodoItemStatus,
  ObjectTodoEntry,
  PublicFeedbackChecklist,
  PublicFeedbackDraft,
  PublicFeedbackGate,
  PublicFeedbackObjectRow,
  PublicFeedbackView,
  publicChecklistAsTodoItem,
  TodoItem,
  todoEntryItemId,
  todoEntrySubItemId,
} from '@models';
import {
  ChecklistFeedbackService,
  PublicFeedbackResult,
} from '@services/checklist-feedback.service';
import { TranslationService } from '@services/translation.service';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { LocaleDatePipe } from '../../../pipes/locale-date.pipe';
import { TodoItemValueControlComponent } from '../../todos/todo-item-value-control.component';

type PageState = 'loading' | 'invalid' | 'gone' | 'identify' | 'editing' | 'submitted';

const SESSION_STORAGE_PREFIX = 'susm.cfb.session.';

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
  imports: [FormsModule, TranslateModule, TodoItemValueControlComponent, LocaleDatePipe, IconComponent],
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
  readonly todoItems = computed(() => {
    const map = new Map<string, TodoItem>();
    for (const checklist of this.checklists()) map.set(checklist.id, publicChecklistAsTodoItem(checklist));
    return map;
  });
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

  todoItem(checklist: PublicFeedbackChecklist): TodoItem {
    return this.todoItems().get(checklist.id) ?? publicChecklistAsTodoItem(checklist);
  }

  draft(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): PublicFeedbackDraft {
    return this.drafts().get(this.rowKey(checklist, row)) ?? baselineDraft(row);
  }

  entries(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): ObjectTodoEntry[] {
    return draftAsTodoEntries(checklist.id, this.draft(checklist, row));
  }

  dirty(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): { status: boolean; note: boolean } {
    return draftDirtyFields(baselineDraft(row), this.drafts().get(this.rowKey(checklist, row)));
  }

  onEntriesChange(
    checklist: PublicFeedbackChecklist,
    row: PublicFeedbackObjectRow,
    entries: ObjectTodoEntry[],
  ): void {
    const entry = entries.find((value) => todoEntryItemId(value) === checklist.id);
    if (!entry) return;
    this.#updateDraft(checklist, row, {
      status: normalizeTodoItemStatus(String(entry.status)),
      todoSubItemId: todoEntrySubItemId(entry),
    });
  }

  onNoteInput(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow, note: string): void {
    this.#updateDraft(checklist, row, { note });
  }

  resetRow(checklist: PublicFeedbackChecklist, row: PublicFeedbackObjectRow): void {
    const next = new Map(this.drafts());
    next.delete(this.rowKey(checklist, row));
    this.drafts.set(next);
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
