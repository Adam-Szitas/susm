import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

export interface BreadcrumbItem {
  /** Display label (e.g. project name, "Projects") */
  label: string;
  /** Route to navigate to; omit for the current page (last item) */
  url?: string;
}

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterLink],
})
export class BreadcrumbComponent {
  /** Breadcrumb items. Last item is usually current page (no url). */
  public items = input.required<BreadcrumbItem[]>();
}
