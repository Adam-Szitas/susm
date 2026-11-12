import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { ModalService } from '@services/modal.service';
import {
  ChecklistFeedbackReviewRow,
  ChecklistFeedbackSubmission,
  formatObjectLabel,
  TodoItemStatus,
} from '@models';
import { ChecklistFeedbackService } from '@services/checklist-feedback.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';

type InboxFilter = 'pending' | 'all';

/**
 * Creator-only review of checklist feedback. Each submission shows the claimed (unverified)
 * email, the live value accept would overwrite, and the proposed value. Accept applies
 * last-write-wins to live checklist entries; reject leaves live data untouched.
 */
@Component({
  selector: 'app-checklist-feedback-inbox',
  standalone: true,
  imports: [TranslateModule, LocaleDatePipe, IconComponent],
  templateUrl: './checklist-feedback-inbox.component.html',
  styleUrl: './checklist-feedback-inbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistFeedbackInboxComponent implements OnInit {
  protected readonly icons = icons;
  #modal = inject(ModalService);
  #api = inject(ChecklistFeedbackService);
  #notifications = inject(NotificationService);
  #translation = inject(TranslationService);
  #projectStore = inject(ProjectStore);

  readonly filter = signal<InboxFilter>('pending');
  readonly loading = signal(false);
  readonly submissions = signal<ChecklistFeedbackSubmission[]>([]);
  readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  close(): void {
    this.#modal.close();
  }

  setFilter(filter: InboxFilter): void {
    if (this.filter() === filter) return;
    this.filter.set(filter);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.#api
      .listSubmissions(this.filter())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.submissions.set(list);
          this.#api.refreshPending();
        },
        error: () => this.submissions.set([]),
      });
  }

  objectLabel(row: ChecklistFeedbackReviewRow): string {
    return formatObjectLabel({
      address: row.object_address,
      prefix: row.object_prefix,
      _id: { $oid: row.object_id },
    });
  }

  statusKey(status: TodoItemStatus | undefined): string {
    return status === 'finished' ? 'todos.statusFinished' : 'todos.statusUnderProcess';
  }

  /** Display value of a live/proposed checklist field (sub-item title wins over status). */
  valueLabel(subTitle: string | undefined, status: TodoItemStatus | undefined): string {
    if (subTitle) return subTitle;
    if (!status) return '—';
    return this.#translation.instant(this.statusKey(status));
  }

  proposedLabel(row: ChecklistFeedbackReviewRow): string | null {
    if (!row.proposed_sub_item_title && !row.proposed_status) return null;
    return this.valueLabel(row.proposed_sub_item_title, row.proposed_status);
  }

  overwrites(row: ChecklistFeedbackReviewRow): boolean {
    const proposed = this.proposedLabel(row);
    return !!proposed && proposed !== this.valueLabel(row.current_sub_item_title, row.current_status);
  }

  changedSinceSubmit(row: ChecklistFeedbackReviewRow): boolean {
    if (!row.baseline_status && !row.baseline_sub_item_title) return false;
    return (
      this.valueLabel(row.baseline_sub_item_title, row.baseline_status) !==
      this.valueLabel(row.current_sub_item_title, row.current_status)
    );
  }

  accept(submission: ChecklistFeedbackSubmission): void {
    if (this.busyId()) return;
    this.busyId.set(submission.id);
    this.#api
      .accept(submission.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (result) => {
          const message = result.skipped.length
            ? this.#translation.instant('checklistFeedback.inbox.acceptedWithSkipped', {
                applied: result.applied,
                skipped: result.skipped.length,
              })
            : this.#translation.instant('checklistFeedback.inbox.accepted');
          this.#notifications.showSuccess(message);
          this.#replace(result.submission);
          this.#refreshProject(submission.project_id);
        },
      });
  }

  reject(submission: ChecklistFeedbackSubmission): void {
    if (this.busyId()) return;
    this.busyId.set(submission.id);
    this.#api
      .reject(submission.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: () => {
          this.#notifications.showSuccess(this.#translation.instant('checklistFeedback.inbox.rejected'));
          this.#replace({ ...submission, status: 'rejected' });
        },
      });
  }

  #replace(updated: ChecklistFeedbackSubmission): void {
    this.submissions.update((list) =>
      this.filter() === 'pending'
        ? list.filter((item) => item.id !== updated.id)
        : list.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    );
  }

  /** Refresh live checklist state if the affected project is open, without a page reload. */
  #refreshProject(projectId: string): void {
    const open = this.#projectStore.project();
    if (open?._id?.$oid === projectId) {
      this.#projectStore.loadProject(projectId).subscribe({ error: () => undefined });
    }
  }
}
