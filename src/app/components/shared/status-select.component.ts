import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatWorkStatus, WORK_STATUSES } from '@models';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-status-select',
  standalone: true,
  imports: [NgClass, TranslateModule],
  templateUrl: './status-select.component.html',
  styleUrl: './status-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StatusSelectComponent),
      multi: true,
    },
  ],
})
export class StatusSelectComponent implements ControlValueAccessor {
  readonly id = input.required<string>();
  readonly selectClass = input('');
  readonly disabled = input(false);

  readonly statuses = WORK_STATUSES;
  readonly statusLabel = formatWorkStatus;

  readonly value = signal('');
  readonly #cvaDisabled = signal(false);

  #onChange: (value: string) => void = () => undefined;
  #onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.#onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.#cvaDisabled.set(isDisabled);
  }

  isDisabled(): boolean {
    return this.disabled() || this.#cvaDisabled();
  }

  onSelect(event: Event): void {
    const next = (event.target as HTMLSelectElement).value;
    this.value.set(next);
    this.#onChange(next);
    this.#onTouched();
  }
}
