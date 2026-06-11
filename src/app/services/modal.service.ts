import {
  Injectable,
  Injector,
  ComponentRef,
  ApplicationRef,
  createComponent,
  inject,
  EnvironmentInjector,
  inputBinding,
} from '@angular/core';
import { ModalComponent } from '../components/modal/modal.component';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';
import { TranslationService } from './translation.service';

export interface ModalConfig {
  title?: string;
  showConfirm?: boolean;
  confirmText?: string;
  content?: string;
  component?: any;
  componentInputs?: Record<string, any>;
  wide?: boolean;
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 'danger' for delete actions, 'primary' for normal confirm */
  confirmKind?: 'danger' | 'primary';
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  private componentRef: ComponentRef<ModalComponent> | null = null;
  private container: HTMLElement | null = null;
  private pendingConfirmResolve: ((value: boolean) => void) | null = null;

  #injector = inject(Injector);
  #appRef = inject(ApplicationRef);
  #translationService = inject(TranslationService);

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'modal-host';
    document.body.appendChild(container);
    document.body.classList.add('modal-open');
    return container;
  }

  open(config?: ModalConfig): { modalRef: ComponentRef<ModalComponent>; childRef?: ComponentRef<any> } {
    // Close any existing modal first
    this.close();

    // Create a fresh container each time
    this.container = this.createContainer();

    this.componentRef = createComponent(ModalComponent, {
      environmentInjector: this.#injector as EnvironmentInjector,
      hostElement: this.container,
    });

    this.#appRef.attachView(this.componentRef.hostView);

    Object.assign(this.componentRef.instance, config || {});
    this.componentRef.instance.modalService = this;

    let childRef: ComponentRef<any> | undefined;
    if (config?.component) {
      childRef = this.injectComponentIntoModal(config.component, config.componentInputs) || undefined;
    }

    return { modalRef: this.componentRef, childRef };
  }

  private injectComponentIntoModal(componentType: any, inputs?: Record<string, any>): ComponentRef<any> | null {
    if (!this.componentRef) return null;
    
    const modalBody = this.componentRef.location.nativeElement.querySelector('.modal-body');
    if (!modalBody) return null;

    // Clear ng-content
    modalBody.innerHTML = '';

    const bindings = inputs
      ? Object.keys(inputs).map((key) => inputBinding(key, () => inputs[key]))
      : [];

    const childComponent = createComponent(componentType, {
      environmentInjector: this.#injector as EnvironmentInjector,
      hostElement: modalBody,
      bindings,
    });

    this.#appRef.attachView(childComponent.hostView);
    return childComponent;
  }

  close() {
    if (this.pendingConfirmResolve) {
      this.pendingConfirmResolve(false);
      this.pendingConfirmResolve = null;
    }
    if (this.componentRef) {
      this.#appRef.detachView(this.componentRef.hostView);
      this.componentRef.destroy();
      this.componentRef = null;
    }

    // Remove container from DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }

    if (!document.querySelector('.modal-host')) {
      document.body.classList.remove('modal-open');
    }
  }

  /** Resolve the pending confirm promise without closing. Used by confirm dialog so the result is fixed before any deferred close(). */
  resolveConfirm(value: boolean): void {
    if (this.pendingConfirmResolve) {
      this.pendingConfirmResolve(value);
      this.pendingConfirmResolve = null;
    }
  }

  /** Opens a confirm modal. Returns a promise that resolves to true if user confirmed, false if cancelled or closed. */
  openConfirm(config: ConfirmConfig): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // Resolve translations so they display correctly in the dynamically created confirm dialog
      const title = this.#translationService.instant(config.title);
      const message = this.#translationService.instant(config.message);
      const confirmText = this.#translationService.instant(config.confirmText ?? 'common.delete');
      const cancelText = this.#translationService.instant(config.cancelText ?? 'common.cancel');
      this.open({
        title,
        component: ConfirmDialogComponent,
        componentInputs: {
          message,
          confirmText,
          cancelText,
          confirmKind: config.confirmKind ?? 'primary',
          modalService: this,
        },
      });
      // Set after open() so the close() inside open() (which clears any previous modal) doesn't resolve this promise
      this.pendingConfirmResolve = resolve;
    });
  }

  confirm(): boolean {
    if (this.componentRef) {
      this.close();
      return true;
    }
    return false;
  }
}
