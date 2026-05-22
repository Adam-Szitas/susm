import { Component, input, output } from '@angular/core';

/** Accessible on/off switch for boolean settings (e.g. save protocol to project). */
@Component({
  selector: 'app-toggle-switch',
  standalone: true,
  template: `
    <label class="toggle-switch" [class.toggle-switch--disabled]="disabled()">
      <input
        type="checkbox"
        role="switch"
        class="toggle-switch-input"
        [checked]="checked()"
        [disabled]="disabled()"
        [attr.aria-checked]="checked()"
        (change)="onInputChange($event)"
      />
      <span class="toggle-switch-track" aria-hidden="true">
        <span class="toggle-switch-thumb"></span>
      </span>
      @if (label()) {
        <span class="toggle-switch-label">{{ label() }}</span>
      }
    </label>
  `,
  styleUrl: './toggle-switch.component.scss',
})
export class ToggleSwitchComponent {
  /** Current on/off state. */
  checked = input(false);
  /** Visible label beside the switch. */
  label = input<string | undefined>(undefined);
  disabled = input(false);

  checkedChange = output<boolean>();

  onInputChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.checkedChange.emit(el.checked);
  }
}
