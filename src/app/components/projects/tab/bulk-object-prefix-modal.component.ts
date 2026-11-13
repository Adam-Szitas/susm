import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ProjectStore } from '@store/project.store';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

@Component({
  selector: 'app-bulk-object-prefix-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <form (submit)="$event.preventDefault(); save()">
    <p>{{ 'objects.bulkPrefixCount' | translate: { count: objectIds().length } }}</p>
    <p class="hint" id="bulk-prefix-hint">{{ 'objects.bulkPrefixHint' | translate }}</p>
    <label for="bulk-object-prefix">{{ 'objects.prefix' | translate }}</label>
    <input
      #prefixInput
      id="bulk-object-prefix"
      name="prefix"
      type="text"
      required
      autocomplete="off"
      [ngModel]="prefix()"
      (ngModelChange)="prefix.set($event)"
      [disabled]="saving()"
      aria-describedby="bulk-prefix-hint bulk-prefix-error"
      [attr.aria-invalid]="!!prefix() && !valid()"
    />
    @if (prefix() && !valid()) {
      <p class="error" id="bulk-prefix-error">{{ 'objects.bulkPrefixInvalid' | translate }}</p>
    }
    @if (error()) {
      <p role="alert" class="error">{{ error() }}</p>
    }
    <footer>
      <button
        type="button"
        class="button button-secondary bulk-prefix-cancel"
        (click)="cancel()"
        [disabled]="saving()"
        [attr.aria-label]="'common.cancel' | translate"
        [title]="'common.cancel' | translate"
      >
        <app-icon [icon]="icons.close" />
      </button>
      <button
        type="submit"
        class="button button-primary bulk-prefix-save"
        [disabled]="!valid() || saving()"
        [attr.aria-busy]="saving()"
        [attr.aria-label]="(saving() ? 'common.saving' : 'common.save') | translate"
        [title]="(saving() ? 'common.saving' : 'common.save') | translate"
      >
        <app-icon [icon]="saving() ? icons.loader : icons.check" />
      </button>
    </footer>
  </form>`,
  styles: `
    form {
      display: grid;
      gap: 0.75rem;
      min-width: 0;
    }
    p {
      margin: 0;
    }
    label {
      font-weight: 600;
    }
    .hint {
      font-size: 0.9rem;
      color: #667085;
    }
    .error {
      color: var(--primary-default, #9d0000);
      font-size: 0.9rem;
    }
    input {
      box-sizing: border-box;
      width: 100%;
      min-height: 44px;
      border: 1px solid #d0d5dd;
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      font: inherit;
      font-size: 16px;
    }
    input:focus-visible {
      outline: 2px solid var(--primary-default, #9d0000);
      outline-offset: 2px;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    button {
      min-width: 44px;
      min-height: 44px;
      margin: 0;
      padding: 0.5rem;
    }
  `,
})
export class BulkObjectPrefixModalComponent implements OnDestroy {
  readonly icons = icons;
  #store = inject(ProjectStore);
  #modal = inject(ModalService);
  #notifications = inject(NotificationService);
  #translation = inject(TranslationService);
  #destroy = inject(DestroyRef);
  #guard = () => !this.saving();
  private prefixInput = viewChild<ElementRef<HTMLInputElement>>('prefixInput');
  projectId = input.required<string>();
  objectIds = input.required<string[]>();
  saved = output<void>();
  prefix = signal('');
  saving = signal(false);
  error = signal('');
  valid = computed(() => {
    const chars = Array.from(this.prefix().trim());
    return (
      this.objectIds().length > 0 &&
      this.objectIds().length <= 10000 &&
      chars.length > 0 &&
      chars.length <= 100 &&
      chars.every((char) => {
        const point = char.codePointAt(0)!;
        return point >= 32 && (point < 127 || point > 159);
      })
    );
  });

  constructor() {
    afterNextRender(() => {
      this.#modal.setCloseGuard(this.#guard);
      this.prefixInput()?.nativeElement.focus();
    });
  }
  ngOnDestroy(): void {
    this.#modal.clearCloseGuard(this.#guard);
  }
  cancel(): void {
    if (!this.saving()) this.#modal.close();
  }
  save(): void {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.#store
      .updateObjectPrefixes(this.projectId(), this.objectIds(), this.prefix().trim())
      .pipe(takeUntilDestroyed(this.#destroy))
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.saved.emit();
          this.#modal.close();
          this.#notifications.showSuccess(
            this.#translation.instant('objects.bulkPrefixSaved', {
              count: result.object_ids.length,
            }),
          );
        },
        error: (error: Error) => {
          this.saving.set(false);
          const message = error.message || this.#translation.instant('objects.bulkPrefixFailed');
          this.error.set(message);
          this.#notifications.showError(message);
        },
      });
  }
}
