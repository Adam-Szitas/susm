import { inject, Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  status?: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  #host: HTMLElement | null = null;
  #home: Node | null = null;
  #modalOutlet: HTMLElement | null = null;

  /** Keep one live notification view, inside the active dialog's non-inert subtree. */
  registerHost(host: HTMLElement): () => void {
    this.#host = host;
    this.#home = host.parentNode;
    this.setModalOutlet(this.#modalOutlet);
    return () => {
      host.querySelector<HTMLElement>('[popover]')?.hidePopover?.();
      if (this.#home && host.parentNode !== this.#home) this.#home.appendChild(host);
      this.#host = null;
      this.#home = null;
    };
  }

  /** Called after opening a native dialog and before destroying a closing dialog. */
  setModalOutlet(outlet: HTMLElement | null): void {
    this.#modalOutlet = outlet;
    const host = this.#host;
    if (!host) return;
    const surface = host.querySelector<HTMLElement>('[popover]');
    // Re-enter the top layer after the new dialog so its backdrop cannot cover toasts.
    surface?.hidePopover?.();
    (outlet ?? this.#home)?.appendChild(host);
    if (surface?.isConnected) surface.showPopover?.();
  }

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
  showError(message: string, duration: number = 5000, status?: number): void {
    this.addNotification({
      id: this.generateId(),
      message,
      type: 'error',
      duration,
      status,
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
    this._notifications.update((notifications) => notifications.filter((n) => n.id !== id));
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
