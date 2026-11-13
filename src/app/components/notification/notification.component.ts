import {
  ChangeDetectionStrategy,
  Component,
  inject,
  afterNextRender,
  DestroyRef,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationComponent {
  protected readonly icons = icons;

  #notificationService = inject(NotificationService);

  readonly notifications = this.#notificationService.notifications;

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement;
    const destroyRef = inject(DestroyRef);
    // Browser-only: native popovers and DOM relocation are skipped during SSR.
    afterNextRender(() => {
      destroyRef.onDestroy(this.#notificationService.registerHost(host));
    });
  }

  removeNotification(id: string): void {
    this.#notificationService.removeNotification(id);
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  }
}
