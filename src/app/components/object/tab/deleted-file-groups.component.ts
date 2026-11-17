import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { FileGroup, fileGroupCategoryLabels } from '../../../models/file.model';
import { parseMongoDateToMs } from '../../../models/mongo-date';
import { DateFormatService } from '../../../services/date-format.service';
import { FileService } from '../../../services/file.service';
import { NotificationService } from '../../../services/notification.service';
import { TranslationService } from '../../../services/translation.service';
import { UserStore } from '../../../store/user.store';

interface DeletedFileGroupRow {
  id: string;
  name: string;
  categories: string[];
  removedAt: string;
  removedAtMs: number;
  photoCount: number;
}

/**
 * "Show deleted file groups" switch for one object; when on, lists the removed groups (loaded
 * from `file/object/{id}/removed-groups`) with a Restore action. Shown only to company admins
 * when the company's `trash` feature is enabled;
 * the backend restores the group at its previous position and keeps individually removed
 * files removed.
 */
@Component({
  selector: 'app-deleted-file-groups',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canView()) {
      <label class="deleted-toggle">
        <input
          type="checkbox"
          role="switch"
          [checked]="expanded()"
          [attr.aria-controls]="expanded() ? 'deleted-file-groups-panel' : null"
          (change)="expanded.set($any($event.target).checked)"
        />
        <span class="toggle-track" aria-hidden="true"></span>
        <span>{{ 'objects.showDeletedFileGroups' | translate }}</span>
        <span class="deleted-file-groups-count">{{ rows().length }}</span>
      </label>
    }
    @if (canView() && expanded()) {
      <div class="deleted-file-groups" id="deleted-file-groups-panel">
        <p class="deleted-file-groups-hint">{{ 'objects.deletedFileGroupsHint' | translate }}</p>
        <ul class="deleted-file-groups-list">
          @for (row of rows(); track row.id) {
            <li class="deleted-file-group">
              <div class="deleted-file-group-text">
                <span class="deleted-file-group-name">{{
                  row.name || ('objects.untitledFileGroup' | translate)
                }}</span>
                @if (row.categories.length > 0) {
                  <span class="deleted-file-group-categories">{{ row.categories.join(', ') }}</span>
                }
                <span class="deleted-file-group-meta">
                  {{ 'objects.fileGroupRemovedAt' | translate: { date: row.removedAt } }} ·
                  {{ 'objects.fileGroupPhotoCount' | translate: { count: row.photoCount } }}
                </span>
              </div>
              <button
                type="button"
                class="button button-secondary"
                (click)="restore(row)"
                [disabled]="restoringIds().has(row.id)"
              >
                {{ 'objects.restore' | translate }}
              </button>
            </li>
          } @empty {
            <li class="deleted-file-groups-empty">{{ 'objects.noDeletedFileGroups' | translate }}</li>
          }
        </ul>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .deleted-toggle {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: fit-content;
      max-width: 100%;
      min-height: 2.75rem;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
    }
    .deleted-toggle input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: 0;
      opacity: 0;
    }
    .toggle-track {
      box-sizing: border-box;
      flex: 0 0 2.75rem;
      height: 1.625rem;
      padding: 0.1875rem;
      border-radius: 999px;
      background: #6b7280;
    }
    .toggle-track::after {
      content: '';
      display: block;
      width: 1.125rem;
      height: 1.125rem;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.15s ease;
    }
    .deleted-toggle input:checked + .toggle-track {
      background: var(--primary-default, #9d0000);
    }
    .deleted-toggle input:checked + .toggle-track::after {
      transform: translateX(1.125rem);
    }
    .deleted-toggle input:focus-visible + .toggle-track {
      outline: 2px solid var(--primary-default, #9d0000);
      outline-offset: 3px;
    }
    .deleted-file-groups {
      margin-top: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fff;
      padding: 0.5rem var(--space-small, 0.75rem);
    }
    .deleted-file-groups-empty {
      padding: 0.6rem 0;
      color: #6b7280;
      font-size: 0.875rem;
    }
    @media (prefers-reduced-motion: reduce) {
      .toggle-track::after {
        transition: none;
      }
    }
    .deleted-file-groups-count {
      min-width: 1.5rem;
      padding: 0 0.4rem;
      border-radius: 999px;
      background: #f3f4f6;
      color: #4b5563;
      font-size: 0.8rem;
      text-align: center;
    }
    .deleted-file-groups-hint {
      margin: 0 0 0.5rem;
      color: #6b7280;
      font-size: 0.875rem;
    }
    .deleted-file-groups-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .deleted-file-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.6rem 0;
      border-top: 1px solid #f0f0f0;
    }
    .deleted-file-group-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .deleted-file-group-name {
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    .deleted-file-group-categories,
    .deleted-file-group-meta {
      color: #6b7280;
      font-size: 0.8rem;
    }
    button {
      flex-shrink: 0;
    }
  `,
})
export class DeletedFileGroupsComponent {
  #fileService = inject(FileService);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #dateFormat = inject(DateFormatService);
  #userStore = inject(UserStore);

  readonly objectId = input<string | undefined>(undefined);
  /** Bump to reload the list (e.g. after a group was removed in the file list). */
  readonly reloadKey = input(0);
  /** Emitted after a successful restore so the parent reloads the object's groups. */
  readonly restored = output<void>();

  readonly canView = computed(() => this.#userStore.isAdmin() && this.#userStore.trashEnabled());
  readonly removedGroups = signal<FileGroup[]>([]);
  readonly restoringIds = signal<Set<string>>(new Set());

  constructor() {
    effect((onCleanup) => {
      const objectId = this.objectId();
      this.reloadKey();
      if (!objectId || !this.canView()) {
        this.removedGroups.set([]);
        return;
      }
      const sub = this.#fileService.getRemovedFileGroupsForObject(objectId).subscribe({
        next: (groups) => this.removedGroups.set(groups ?? []),
        error: () => this.removedGroups.set([]),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  readonly rows = computed<DeletedFileGroupRow[]>(() =>
    this.removedGroups()
      .map((group) => ({ group, removedAtMs: parseMongoDateToMs(group.deleted_at as unknown) }))
      .filter(
        (entry): entry is { group: FileGroup; removedAtMs: number } =>
          entry.removedAtMs != null && !!entry.group._id?.$oid,
      )
      .sort((a, b) => b.removedAtMs - a.removedAtMs)
      .map(({ group, removedAtMs }) => ({
        id: group._id.$oid,
        name: group.description?.trim() ?? '',
        categories: fileGroupCategoryLabels(group),
        removedAt: this.#dateFormat.formatDateTime(removedAtMs),
        removedAtMs,
        photoCount: (group.files ?? []).filter(
          (file) => parseMongoDateToMs((file as { deleted_at?: unknown }).deleted_at) == null,
        ).length,
      })),
  );

  /** Switch state: the list of removed groups is shown below the toggle when on. */
  readonly expanded = signal(false);

  restore(row: DeletedFileGroupRow): void {
    if (this.restoringIds().has(row.id)) return;
    this.restoringIds.update((ids) => new Set(ids).add(row.id));
    this.#fileService
      .restoreFileGroup(row.id)
      .pipe(
        finalize(() =>
          this.restoringIds.update((ids) => {
            const next = new Set(ids);
            next.delete(row.id);
            return next;
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.#notificationService.showSuccess(
            this.#translationService.instant('objects.fileGroupRestored'),
          );
          this.removedGroups.update((groups) => groups.filter((g) => g._id?.$oid !== row.id));
          this.restored.emit();
        },
        error: (error) => {
          this.#notificationService.showError(
            error?.message || this.#translationService.instant('objects.fileGroupRestoreFailed'),
          );
        },
      });
  }
}
