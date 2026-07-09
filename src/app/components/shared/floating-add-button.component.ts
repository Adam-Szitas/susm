import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

@Component({
  selector: 'app-floating-add-button',
  standalone: true,
  imports: [TranslateModule, NgClass, IconComponent],
  templateUrl: './floating-add-button.component.html',
  styleUrl: './floating-add-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingAddButtonComponent {
  protected readonly icons = icons;
  readonly ariaLabel = input.required<string>();
  readonly extraClass = input('');
  readonly clicked = output<void>();
}
