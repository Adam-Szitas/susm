import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/** Below this count, render all items (no virtual scroll overhead). */
export const VIRTUAL_SCROLL_DEFAULT_THRESHOLD = 50;

@Component({
  selector: 'app-virtual-scroll-viewport',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './virtual-scroll-viewport.component.html',
  styleUrl: './virtual-scroll-viewport.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VirtualScrollViewportComponent<T> implements AfterViewInit {
  #destroyRef = inject(DestroyRef);
  #host = inject(ElementRef<HTMLElement>);

  readonly itemTemplate = contentChild(TemplateRef);

  readonly viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');

  /** Full data set (virtual scroll slices this). */
  items = input.required<T[]>();
  /** Fixed row height in px, including gap between rows. */
  itemSize = input(72);
  /** Enable virtual scroll only when length exceeds this. */
  threshold = input(VIRTUAL_SCROLL_DEFAULT_THRESHOLD);
  /** Viewport max height (CSS length). Ignored when {@link fill} is true. */
  maxHeight = input('min(68dvh, 720px)');
  /** Stretch viewport to fill the parent flex region (height: 100%). */
  fill = input(false);
  /** Extra pixels rendered above/below the visible window. */
  bufferPx = input(360);
  /** Optional accessible name for the list. */
  ariaLabel = input('');
  trackBy = input<(index: number, item: T) => unknown>((index) => index);

  readonly rangeStart = signal(0);
  readonly rangeEnd = signal(20);
  readonly #scrollTop = signal(0);
  readonly #viewportHeight = signal(480);

  readonly useVirtualScroll = computed(() => this.items().length > this.threshold());

  readonly totalHeight = computed(() => this.items().length * this.itemSize());

  readonly transform = computed(() => `translate3d(0, ${this.rangeStart() * this.itemSize()}px, 0)`);

  readonly visibleRows = computed(() => {
    const items = this.items();
    const start = this.rangeStart();
    const end = this.rangeEnd();
    const rows: { item: T; index: number }[] = [];
    for (let i = start; i < end && i < items.length; i++) {
      rows.push({ item: items[i], index: i });
    }
    return rows;
  });

  constructor() {
    effect(() => {
      const total = this.items().length;
      const itemSize = this.itemSize();
      const viewportHeight = this.#viewportHeight();
      this.#updateRange(this.#scrollTop(), viewportHeight, total, itemSize);
    });

    effect(() => {
      if (!this.useVirtualScroll()) return;
      this.fill();
      this.items().length;
      queueMicrotask(() => this.#measureViewport());
    });
  }

  ngAfterViewInit(): void {
    this.#measureViewport();
  }

  #measureViewport(): void {
    const el = this.viewportRef()?.nativeElement;
    if (!el) return;

    const sync = () => {
      let height = el.clientHeight;
      if (height < 1 && this.fill()) {
        height = this.#host.nativeElement.clientHeight;
      }
      if (height < 1) {
        height = 480;
      }
      this.#viewportHeight.set(height);
      this.#updateRange(el.scrollTop, height, this.items().length, this.itemSize());
    };

    sync();

    if (!this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver(() => sync());
      this.#resizeObserver.observe(el);
      this.#resizeObserver.observe(this.#host.nativeElement);
      this.#destroyRef.onDestroy(() => {
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = undefined;
      });
    }
  }

  #resizeObserver?: ResizeObserver;

  onScroll(): void {
    const el = this.viewportRef()?.nativeElement;
    if (!el) return;
    this.#scrollTop.set(el.scrollTop);
    this.#viewportHeight.set(el.clientHeight);
    this.#updateRange(el.scrollTop, el.clientHeight, this.items().length, this.itemSize());
  }

  trackRow(_index: number, row: { item: T; index: number }): unknown {
    return this.trackBy()(row.index, row.item);
  }

  trackItem(index: number, item: T): unknown {
    return this.trackBy()(index, item);
  }

  #updateRange(scrollTop: number, viewportHeight: number, total: number, itemSize: number): void {
    if (total <= this.threshold()) {
      this.rangeStart.set(0);
      this.rangeEnd.set(total);
      return;
    }

    const buffer = this.bufferPx();
    const start = Math.max(0, Math.floor((scrollTop - buffer) / itemSize));
    const count = Math.ceil((viewportHeight + buffer * 2) / itemSize);
    const end = Math.min(total, start + count);
    this.rangeStart.set(start);
    this.rangeEnd.set(end);
  }
}
