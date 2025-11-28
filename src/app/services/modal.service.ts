import {
  Injectable,
  Injector,
  ComponentRef,
  ApplicationRef,
  createComponent,
  inject,
  EnvironmentInjector,
} from '@angular/core';
import { ModalComponent } from '../components/modal/modal.component';

export interface ModalConfig {
  title?: string;
  showConfirm?: boolean;
  confirmText?: string;
  content?: string;
  component?: any;
  componentInputs?: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  private componentRef: ComponentRef<ModalComponent> | null = null;
  private container: HTMLElement | null = null;

  #injector = inject(Injector);
  #appRef = inject(ApplicationRef);

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
  }

  open(config?: ModalConfig): ComponentRef<ModalComponent> {
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

    if (config?.component) {
      this.injectComponentIntoModal(config.component, config.componentInputs);
    }

    return this.componentRef;
  }

  private injectComponentIntoModal(componentType: any, inputs?: Record<string, any>) {
    if (!this.componentRef) return;
    
    const modalBody = this.componentRef.location.nativeElement.querySelector('.modal-body');
    if (!modalBody) return;

    // Clear ng-content
    modalBody.innerHTML = '';

    // Create component in modal body
    const childComponent = createComponent(componentType, {
      environmentInjector: this.#injector as EnvironmentInjector,
      hostElement: modalBody,
    });

    // Set inputs if provided - use setInput() for signal inputs
    if (inputs) {
      Object.keys(inputs).forEach(key => {
        childComponent.setInput(key, inputs[key]);
      });
    }

    this.#appRef.attachView(childComponent.hostView);
  }

  close() {
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
  }

  confirm(): boolean {
    if (this.componentRef) {
      this.close();
      return true;
    }
    return false;
  }
}
