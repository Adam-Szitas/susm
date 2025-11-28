import { inject, Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();

  /**
   * Show a success notification
   */
  showSuccess(message: string, duration: number = 3000): void {
    this.addNotification({
      id: this.generateId(),
      message,
      type: 'success',
      duration,
    });
  }

  /**
   * Show an error notification
   */
  showError(message: string, duration: number = 5000): void {
    this.addNotification({
      id: this.generateId(),
      message,
      type: 'error',
      duration,
    });
  }

  /**
   * Show an info notification
   */
  showInfo(message: string, duration: number = 3000): void {
    this.addNotification({
      id: this.generateId(),
      message,
      type: 'info',
      duration,
    });
  }

  /**
   * Show a warning notification
   */
  showWarning(message: string, duration: number = 4000): void {
    this.addNotification({
      id: this.generateId(),
      message,
      type: 'warning',
      duration,
    });
  }

  /**
   * Remove a notification by ID
   */
  removeNotification(id: string): void {
    this._notifications.update((notifications) =>
      notifications.filter((n) => n.id !== id)
    );
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this._notifications.set([]);
  }

  private addNotification(notification: Notification): void {
    this._notifications.update((notifications) => [...notifications, notification]);

    // Auto-remove after duration
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

