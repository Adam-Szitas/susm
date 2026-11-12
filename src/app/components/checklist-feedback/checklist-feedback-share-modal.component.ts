import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { ChecklistFeedbackShare, TodoItem, todoItemId } from '@models';
import { ChecklistFeedbackService } from '@services/checklist-feedback.service';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { copyTextToClipboard } from '../../utils/clipboard';
import { ChecklistFeedbackInboxComponent } from './checklist-feedback-inbox.component';

export const MAX_FEEDBACK_LINKS_PER_CREATE = 20;

/**
 * Creates copyable public feedback URLs for the selected checklists. SUSM never sends
 * these links by email; the app-user shares them through their own channels.
 */
@Component({
  selector: 'app-checklist-feedback-share-modal',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, TranslateModule, LocaleDatePipe, IconComponent],
  templateUrl: './checklist-feedback-share-modal.component.html',
  styleUrl: './checklist-feedback-share-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistFeedbackShareModalComponent implements OnInit, OnDestroy {
  protected readonly icons = icons;
  #api = inject(ChecklistFeedbackService);
  #notifications = inject(NotificationService);
  #translation = inject(TranslationService);
  #modal = inject(ModalService);

  readonly projectId = input.required<string>();
  readonly todoItems = input.required<TodoItem[]>();
  /** All project checklists, so existing links can name checklists that aren't selected now. */
  readonly allTodoItems = input<TodoItem[]>([]);

  readonly label = signal('');
  readonly count = signal(1);
  readonly creating = signal(false);
  readonly loadingShares = signal(false);
  readonly justCreated = signal<ChecklistFeedbackShare[]>([]);
  readonly shares = signal<ChecklistFeedbackShare[]>([]);
  readonly copiedId = signal<string | null>(null);
  readonly now = signal(Date.now());

  /**
   * Saved object assignments per selected checklist id. The public page shows only checklists
   * with assigned objects, so a link where every count is 0 would be unusable. `null` = unknown.
   */
  readonly assignedObjectCounts = input<Record<string, number> | null>(null);

  readonly objectCountFor = (item: TodoItem): number | null => {
    const counts = this.assignedObjectCounts();
    return counts ? (counts[todoItemId(item)] ?? 0) : null;
  };
  readonly hasNoAssignedObjects = computed(
    () => this.assignedObjectCounts() !== null && this.todoItems().every((item) => !this.objectCountFor(item)),
  );
  readonly hasEmptyChecklist = computed(
    () => this.assignedObjectCounts() !== null && this.todoItems().some((item) => !this.objectCountFor(item)),
  );

  readonly canCreate = computed(
    () => this.todoItems().length > 0 && !this.hasNoAssignedObjects() && !this.creating(),
  );
  readonly titlesById = computed(() => {
    const map = new Map<string, string>();
    for (const item of [...this.allTodoItems(), ...this.todoItems()]) map.set(todoItemId(item), item.title);
    return map;
  });

  #tick: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.refreshShares();
    this.#tick = setInterval(() => this.now.set(Date.now()), 30_000);
  }

  ngOnDestroy(): void {
    if (this.#tick) clearInterval(this.#tick);
  }

  setCount(value: unknown): void {
    const parsed = Math.round(Number(value));
    this.count.set(Number.isFinite(parsed) ? Math.min(MAX_FEEDBACK_LINKS_PER_CREATE, Math.max(1, parsed)) : 1);
  }

  create(): void {
    if (!this.canCreate()) return;
    this.creating.set(true);
    const ids = this.todoItems().map(todoItemId);
    this.#api
      .createShares(this.projectId(), ids, this.count(), this.label())
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: (created) => {
          this.justCreated.set(created);
          this.label.set('');
          this.count.set(1);
          this.refreshShares();
        },
        error: (error) =>
          this.#notifications.showError(
            error?.message || this.#translation.instant('checklistFeedback.share.createFailed'),
          ),
      });
  }

  refreshShares(): void {
    this.loadingShares.set(true);
    this.#api
      .listShares(this.projectId())
      .pipe(finalize(() => this.loadingShares.set(false)))
      .subscribe({ next: (list) => this.shares.set(list), error: () => this.shares.set([]) });
  }

  async copy(share: ChecklistFeedbackShare): Promise<void> {
    const ok = await copyTextToClipboard(share.url);
    if (ok) {
      this.copiedId.set(share.id);
      setTimeout(() => this.copiedId() === share.id && this.copiedId.set(null), 2000);
    } else {
      this.#notifications.showError(this.#translation.instant('checklistFeedback.share.copyFailed'));
    }
  }

  async revoke(share: ChecklistFeedbackShare): Promise<void> {
    const confirmed = await this.#modal.openConfirm({
      title: 'checklistFeedback.share.revoke',
      message: 'checklistFeedback.share.revokeConfirm',
      confirmText: 'checklistFeedback.share.revoke',
      cancelText: 'common.cancel',
      confirmKind: 'danger',
      stack: true,
    });
    if (!confirmed) return;
    this.#api.revokeShare(this.projectId(), share.id).subscribe({
      next: () => {
        this.justCreated.update((list) => list.filter((item) => item.id !== share.id));
        this.refreshShares();
      },
    });
  }

  close(): void {
    this.#modal.close();
  }

  openInbox(): void {
    this.#modal.open({
      title: 'checklistFeedback.inbox.title',
      stack: true,
      extraWide: true,
      component: ChecklistFeedbackInboxComponent,
    });
  }

  checklistTitles(share: ChecklistFeedbackShare): string {
    return share.todo_item_ids
      .map((id) => this.titlesById().get(id))
      .filter((title): title is string => !!title)
      .join(', ');
  }

  /** Remaining time as `{ h, m }`, or null once expired. */
  remaining(share: ChecklistFeedbackShare): { h: number; m: number } | null {
    const ms = new Date(share.expires_at).getTime() - this.now();
    if (share.status !== 'open' || !Number.isFinite(ms) || ms <= 0) return null;
    // Floor so a fresh 24h link reads "23 h 59 min", never "24 h 1 min".
    const minutes = Math.max(1, Math.floor(ms / 60_000));
    return { h: Math.floor(minutes / 60), m: minutes % 60 };
  }

  effectiveStatus(share: ChecklistFeedbackShare): ChecklistFeedbackShare['status'] {
    if (share.status === 'open' && this.remaining(share) === null) return 'expired';
    return share.status;
  }
}
