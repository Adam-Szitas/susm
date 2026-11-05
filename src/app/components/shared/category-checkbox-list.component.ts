import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-category-checkbox-list',
  standalone: true,
  template: `
    <div class="category-checkbox-list" role="group" [attr.aria-label]="label()">
      @for (category of categories(); track category) {
        <label class="category-checkbox-option">
          <input
            type="checkbox"
            [checked]="selected().includes(category)"
            [disabled]="disabled()"
            [attr.aria-label]="category"
            (change)="selectionChange.emit(category)"
          />
          <span>{{ category }}</span>
        </label>
      }
    </div>
  `,
  styleUrl: './category-checkbox-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryCheckboxListComponent {
  readonly categories = input<string[]>([]);
  readonly selected = input<string[]>([]);
  readonly disabled = input(false);
  readonly label = input('Categories');
  readonly selectionChange = output<string>();
}
