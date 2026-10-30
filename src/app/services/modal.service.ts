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
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';
import { TranslationService } from './translation.service';
import { lockDocumentScroll, unlockDocumentScroll } from './document-scroll-lock';

export interface ModalConfig {
  title?: string;
  showConfirm?: boolean;
  confirmText?: string;
  content?: string;
  component?: any;
  componentInputs?: Record<string, any>;
  wide?: boolean;
  /** Extra-wide modal (max 1600px) — project checklist, protocol generate. */
  extraWide?: boolean;
  /** Keep the current modal open and show this one above it. */
  stack?: boolean;
}

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 'danger' for delete actions, 'primary' for normal confirm */
  confirmKind?: 'danger' | 'primary';
  /** Keep the current modal open and show the confirm above it. */
  stack?: boolean;
}

type ModalCloseGuard = () => boolean | Promise<boolean>;

interface ModalLayer {
  componentRef: ComponentRef<ModalComponent>;
  childRef: ComponentRef<unknown> | null;
  container: HTMLElement;
  beforeClose?: ModalCloseGuard;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  private componentRef: ComponentRef<ModalComponent> | null = null;
  private childRef: ComponentRef<unknown> | null = null;
  private container: HTMLElement | null = null;
  private pendingConfirmResolve: ((value: boolean) => void) | null = null;
  #layers: ModalLayer[] = [];
  #closeGuardPending = false;

  #injector = inject(Injector);
  #appRef = inject(ApplicationRef);
  #translationService = inject(TranslationService);

  private createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'modal-host';
    document.body.appendChild(container);
    lockDocumentScroll();
    return container;
  }

  open(config?: ModalConfig): {
    modalRef: ComponentRef<ModalComponent>;
    childRef?: ComponentRef<any>;
  } {
    if (!config?.stack) {
      this.closeAll();
    }

    const container = this.createContainer();
    container.style.zIndex = String(10500 + this.#layers.length * 20);

    const componentRef = createComponent(ModalComponent, {
      environmentInjector: this.#injector as EnvironmentInjector,
      hostElement: container,
    });

    this.#appRef.attachView(componentRef.hostView);

    const instance = componentRef.instance;
    instance.title = config?.title ?? instance.title;
    instance.showConfirm = config?.showConfirm ?? instance.showConfirm;
    instance.confirmText = config?.confirmText ?? instance.confirmText;
    // Mutually exclusive — both true left `.wide` (800px) winning over `.wide-xl`.
    instance.wide = !!config?.wide && !config?.extraWide;
    instance.extraWide = !!config?.extraWide;
    instance.modalService = this;

    const layer: ModalLayer = { componentRef, childRef: null, container };
    this.#layers.push(layer);
    this.#syncTop();

    // Paint the shell (title, size classes, #dynamicContent) before inserting the body.
    componentRef.changeDetectorRef.detectChanges();
    this.#applySize(layer, !!config?.extraWide, !!config?.wide);

    if (config?.component) {
      layer.childRef = this.#inject(layer, config.component, config.componentInputs);
      this.#syncTop();

      // Zoneless change detection can recreate the modal view and drop the body.
      const component = config.component;
      const inputs = config.componentInputs;
      const remountIfEmpty = () => {
        if (!this.#layers.includes(layer)) return;
        if (this.#bodyHasContent(layer)) return;
        layer.childRef = this.#inject(layer, component, inputs);
        this.#syncTop();
      };
      queueMicrotask(remountIfEmpty);
      setTimeout(remountIfEmpty, 0);
    }

    container.querySelector<HTMLDialogElement>('dialog.modal-content')?.showModal();
    return { modalRef: componentRef, childRef: layer.childRef ?? undefined };
  }

  #syncTop(): void {
    const top = this.#layers.at(-1);
    this.componentRef = top?.componentRef ?? null;
    this.childRef = top?.childRef ?? null;
    this.container = top?.container ?? null;
  }

  #applySize(layer: ModalLayer, extraWide: boolean, wide: boolean): void {
    const content = layer.componentRef.location.nativeElement.querySelector(
      '.modal-content',
    ) as HTMLElement | null;
    if (!content) return;
    content.classList.toggle('wide', wide && !extraWide);
    content.classList.toggle('wide-xl', extraWide);
    if (extraWide) {
      content.style.maxWidth = 'min(100%, 1600px)';
      content.style.minHeight = 'min(70dvh, 720px)';
    } else {
      content.style.maxWidth = '';
      content.style.minHeight = '';
    }
  }

  #bodyHasContent(layer: ModalLayer): boolean {
    const body = layer.componentRef.location.nativeElement.querySelector('.modal-body');
    return !!body?.firstElementChild;
  }

  #inject(
    layer: ModalLayer,
    componentType: any,
    inputs?: Record<string, any>,
  ): ComponentRef<any> | null {
    if (layer.childRef) {
      layer.childRef.destroy();
      layer.childRef = null;
    }

    const vcr = layer.componentRef.instance.dynamicContent;
    let childComponent: ComponentRef<any>;

    if (vcr) {
      vcr.clear();
      childComponent = vcr.createComponent(componentType);
    } else {
      const modalBody = layer.componentRef.location.nativeElement.querySelector(
        '.modal-body',
      ) as HTMLElement | null;
      if (!modalBody) return null;
      const outlet = document.createElement('div');
      outlet.className = 'modal-outlet';
      modalBody.replaceChildren(outlet);
      childComponent = createComponent(componentType, {
        environmentInjector: this.#injector as EnvironmentInjector,
        hostElement: outlet,
      });
      this.#appRef.attachView(childComponent.hostView);
    }

    if (inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        childComponent.setInput(key, value);
      }
    }

    childComponent.changeDetectorRef.detectChanges();
    return childComponent;
  }

  /** Ask before the top modal closes. Used by the checklist modal when edits are unsaved. */
  setCloseGuard(guard: ModalCloseGuard): void {
    const layer = this.#layers.at(-1);
    if (layer) layer.beforeClose = guard;
  }

  clearCloseGuard(guard: ModalCloseGuard): void {
    for (const layer of this.#layers) {
      if (layer.beforeClose === guard) layer.beforeClose = undefined;
    }
  }

  /** Close every open modal, topmost first. Skips close guards. */
  closeAll(): void {
    while (this.#layers.length) {
      const before = this.#layers.length;
      this.#closeTop(true);
      if (this.#layers.length >= before) break;
    }
  }

  /** Close the topmost modal. A stacked editor closes without dismissing the one under it. */
  close() {
    this.#closeTop(false);
  }

  #closeTop(force: boolean): void {
    const layer = this.#layers.at(-1);
    if (!layer) return;

    // Repeated Escape/close requests must not bypass an unresolved unsaved-change guard.
    if (!force && layer.beforeClose && this.#closeGuardPending) return;

    if (!force && layer.beforeClose && !this.#closeGuardPending) {
      const result = layer.beforeClose();
      if (result instanceof Promise) {
        this.#closeGuardPending = true;
        void result.then((ok) => {
          setTimeout(() => {
            this.#closeGuardPending = false;
            if (!ok || !this.#layers.includes(layer)) return;
            while (this.#layers.length && this.#layers.at(-1) !== layer) {
              this.#closeTop(true);
            }
            if (this.#layers.at(-1) === layer) this.#closeTop(true);
          }, 0);
        });
        return;
      }
      if (!result) return;
    }

    layer.container.querySelector<HTMLDialogElement>('dialog.modal-content')?.close();
    this.#layers.pop();

    if (this.pendingConfirmResolve) {
      this.pendingConfirmResolve(false);
      this.pendingConfirmResolve = null;
    }
    if (layer.childRef) {
      layer.childRef.destroy();
    }
    this.#appRef.detachView(layer.componentRef.hostView);
    layer.componentRef.destroy();
    if (layer.container.parentNode) {
      layer.container.parentNode.removeChild(layer.container);
    }
    this.#syncTop();

    if (!document.querySelector('.modal-host')) {
      unlockDocumentScroll();
    }
  }

  resolveConfirm(value: boolean): void {
    if (this.pendingConfirmResolve) {
      this.pendingConfirmResolve(value);
      this.pendingConfirmResolve = null;
    }
  }

  openConfirm(config: ConfirmConfig): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const title = this.#translationService.instant(config.title);
      const message = this.#translationService.instant(config.message);
      const confirmText = this.#translationService.instant(config.confirmText ?? 'common.delete');
      const cancelText = this.#translationService.instant(config.cancelText ?? 'common.cancel');
      this.open({
        title,
        stack: config.stack,
        component: ConfirmDialogComponent,
        componentInputs: {
          message,
          confirmText,
          cancelText,
          confirmKind: config.confirmKind ?? 'primary',
          modalService: this,
        },
      });
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
