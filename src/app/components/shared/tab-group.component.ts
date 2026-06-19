import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number | null;
  disabled?: boolean;
}

let tabGroupInstanceCounter = 0;

/** Accessible tab group — segmented tabs on narrow viewports, side-by-side panels on wide. */
@Component({
  selector: 'app-tab-group',
  standalone: true,
  templateUrl: './tab-group.component.html',
  styleUrl: './tab-group.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabGroupComponent {
  #destroyRef = inject(DestroyRef);
  #platformId = inject(PLATFORM_ID);
  readonly #instanceId = `tab-group-${++tabGroupInstanceCounter}`;

  /** Tab definitions shown in the tab list (hidden when expanded to columns). */
  tabs = input<TabItem[]>([]);
  /** Active tab id (two-way bindable). */
  activeTabId = model('');
  /** Accessible name for the tab list. */
  ariaLabel = input('');
  /** Viewports below this width (px) use segmented tabs instead of columns. */
  collapseBelowPx = input(769);
  /** Always use segmented tabs (e.g. inside modals), regardless of viewport width. */
  forceTabs = input(false);

  readonly #viewportCollapsed = signal(this.#readCollapsedState());
  readonly collapsed = computed(() => this.forceTabs() || this.#viewportCollapsed());

  constructor() {
    if (isPlatformBrowser(this.#platformId)) {
      const query = () => `(max-width: ${this.collapseBelowPx() - 1}px)`;
      const mq = window.matchMedia(query());
      const apply = () => this.#viewportCollapsed.set(mq.matches);
      mq.addEventListener('change', apply);
      this.#destroyRef.onDestroy(() => mq.removeEventListener('change', apply));
    }

    effect(() => {
      const items = this.tabs();
      const current = this.activeTabId();
      if (!items.length) return;
      if (!items.some((item) => item.id === current)) {
        const firstEnabled = items.find((item) => !item.disabled) ?? items[0];
        this.activeTabId.set(firstEnabled.id);
      }
    });
  }

  #readCollapsedState(): boolean {
    if (!isPlatformBrowser(this.#platformId)) {
      return true;
    }
    return window.matchMedia(`(max-width: ${this.collapseBelowPx() - 1}px)`).matches;
  }

  tabButtonId(tabId: string): string {
    return `${this.#instanceId}-tab-${tabId}`;
  }

  tabPanelId(tabId: string): string {
    return `${this.#instanceId}-panel-${tabId}`;
  }

  selectTab(tabId: string): void {
    const tab = this.tabs().find((item) => item.id === tabId);
    if (!tab || tab.disabled) return;
    this.activeTabId.set(tabId);
  }

  isPanelVisible(tabId: string): boolean {
    return !this.collapsed() || this.activeTabId() === tabId;
  }

  onTabKeydown(event: KeyboardEvent, index: number): void {
    const items = this.tabs().filter((item) => !item.disabled);
    if (!items.length) return;

    const currentItem = this.tabs()[index];
    const enabledIndex = items.findIndex((item) => item.id === currentItem?.id);
    if (enabledIndex < 0) return;

    let nextIndex = enabledIndex;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        nextIndex = enabledIndex === 0 ? items.length - 1 : enabledIndex - 1;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        nextIndex = enabledIndex === items.length - 1 ? 0 : enabledIndex + 1;
        break;
      case 'Home':
        event.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    const nextTab = items[nextIndex];
    this.selectTab(nextTab.id);
    queueMicrotask(() => {
      document.getElementById(this.tabButtonId(nextTab.id))?.focus();
    });
  }
}
