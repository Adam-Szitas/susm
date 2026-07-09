import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { StatusSelectComponent } from './status-select.component';

@Component({
  selector: 'app-project-form-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, StatusSelectComponent],
  templateUrl: './project-form-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFormFieldsComponent {
  readonly form = input.required<FormGroup>();
  readonly showStatus = input(true);
  readonly idPrefix = input('');
}
