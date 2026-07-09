import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-detail-field',
  standalone: true,
  templateUrl: './detail-field.component.html',
  styleUrl: './detail-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailFieldComponent {
  readonly label = input.required<string>();
  readonly fullWidth = input(false);
  readonly labelFor = input<string | null>(null);
}
