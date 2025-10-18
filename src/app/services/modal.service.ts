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
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  private componentRef!: ComponentRef<ModalComponent>;
  private container!: HTMLElement;

  #injector = inject(Injector);
  #appRef = inject(ApplicationRef);

  private getOrCreateContainer(): HTMLElement {
    if (this.container) return this.container;

    this.container = document.createElement('div');
    this.container.style.position = 'relative';
    this.container.style.zIndex = '9999';
    document.body.appendChild(this.container);

    return this.container;
  }

  open(config?: ModalConfig): ComponentRef<ModalComponent> {
    const container = this.getOrCreateContainer();

    this.componentRef = createComponent(ModalComponent, {
      environmentInjector: this.#injector as EnvironmentInjector,
      hostElement: container,
    });

    this.#appRef.attachView(this.componentRef.hostView);

    Object.assign(this.componentRef.instance, config || {});
    this.componentRef.instance.modalService = this;

    if (config?.component) {
      this.injectComponentIntoModal(config.component);
    }

    return this.componentRef;
  }

  private injectComponentIntoModal(componentType: any) {
    const modalBody = this.componentRef.location.nativeElement.querySelector('.modal-body');
    if (!modalBody) return;

    // Clear ng-content
    modalBody.innerHTML = '';

    // Create component in modal body
    const childComponent = createComponent(componentType, {
      environmentInjector: this.#injector as EnvironmentInjector,
      hostElement: modalBody,
    });

    this.#appRef.attachView(childComponent.hostView);
  }

  close() {
    if (this.componentRef) {
      this.#appRef.detachView(this.componentRef.hostView);
      this.componentRef.destroy();
      this.componentRef = null!;
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
