import { Component, input } from '@angular/core';

/** Trash/bin icon for delete actions (stroke inherits `currentColor`). */
@Component({
  selector: 'app-trash-icon',
  standalone: true,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      flex-shrink: 0;
    }
  `,
})
export class TrashIconComponent {
  size = input(20);
  strokeWidth = input(2);
}
