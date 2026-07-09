import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DEFAULT_WORK_STATUS,
  Project,
  formatProjectAddressLines,
} from '@models';
import { StatusPillComponent } from '../status-pill/app-status-pill.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [RouterLink, StatusPillComponent, LocaleDatePipe, TranslateModule],
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCardComponent {
  readonly project = input.required<Project>();
  readonly routerLink = input.required<string | string[]>();
  readonly defaultStatus = DEFAULT_WORK_STATUS;

  readonly addressLines = computed(() => formatProjectAddressLines(this.project().address));
}
