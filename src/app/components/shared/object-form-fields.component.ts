import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { StatusSelectComponent } from './status-select.component';

@Component({
  selector: 'app-object-form-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, StatusSelectComponent],
  templateUrl: './object-form-fields.component.html',
  styleUrl: './edit-form-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectFormFieldsComponent {
  readonly form = input.required<FormGroup>();
  readonly idPrefix = input('');
}
