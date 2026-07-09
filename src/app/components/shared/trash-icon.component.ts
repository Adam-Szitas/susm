import { Component, input } from '@angular/core';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';

/** Trash/bin icon for delete actions (stroke inherits `currentColor`). */
@Component({
  selector: 'app-trash-icon',
  standalone: true,
  imports: [IconComponent],
  host: {
    '[style.--icon-size.px]': 'size()',
  },
  template: `<app-icon [icon]="icons.trash" [strokeWidth]="strokeWidth()" />`,
})
export class TrashIconComponent {
  protected readonly icons = icons;
  size = input(20);
  strokeWidth = input(2);
}
