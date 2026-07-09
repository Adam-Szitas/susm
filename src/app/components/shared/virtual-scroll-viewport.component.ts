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
  host: {
    '[class.virtual-scroll-host--fill]': 'fill()',
    '[class.virtual-scroll-host--grid]': 'gridLayout()',
  },
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
  /** Render items in a responsive grid instead of a single column. */
  gridLayout = input(false);
  /** Minimum column width (px) when {@link gridLayout} is enabled. */
  gridMinColumnWidth = input(260);
  /** Extra pixels rendered above/below the visible window. */
  bufferPx = input(360);
  /** Optional accessible name for the list. */
  ariaLabel = input('');
  trackBy = input<(index: number, item: T) => unknown>((index) => index);

  readonly rangeStart = signal(0);
  readonly rangeEnd = signal(20);
  readonly #scrollTop = signal(0);
  readonly #viewportHeight = signal(480);
  readonly #viewportWidth = signal(800);

  readonly useVirtualScroll = computed(() => this.items().length > this.threshold());

  readonly columnCount = computed(() => {
    if (!this.gridLayout()) {
      return 1;
    }

    const gap = 16;
    const minWidth = this.gridMinColumnWidth();
    const width = this.#viewportWidth();
    return Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
  });

  readonly rowCount = computed(() => {
    const total = this.items().length;
    if (!this.gridLayout()) {
      return total;
    }
    return Math.ceil(total / this.columnCount());
  });

  readonly totalHeight = computed(() => this.rowCount() * this.itemSize());

  readonly transform = computed(() => `translate3d(0, ${this.rangeStart() * this.itemSize()}px, 0)`);

  readonly visibleRows = computed(() => {
    const items = this.items();
    const start = this.rangeStart();
    const end = this.rangeEnd();
    const columns = this.columnCount();
    const rows: { cells: { item: T; index: number }[] }[] = [];

    if (this.gridLayout()) {
      for (let rowIndex = start; rowIndex < end; rowIndex++) {
        const cells: { item: T; index: number }[] = [];
        const startIndex = rowIndex * columns;
        for (let column = 0; column < columns && startIndex + column < items.length; column++) {
          const index = startIndex + column;
          cells.push({ item: items[index], index });
        }
        if (cells.length) {
          rows.push({ cells });
        }
      }
      return rows;
    }

    for (let index = start; index < end && index < items.length; index++) {
      rows.push({ cells: [{ item: items[index], index }] });
    }
    return rows;
  });

  constructor() {
    effect(() => {
      const total = this.rowCount();
      const itemSize = this.itemSize();
      const viewportHeight = this.#viewportHeight();
      this.#updateRange(this.#scrollTop(), viewportHeight, total, itemSize);
    });

    effect(() => {
      if (!this.useVirtualScroll()) return;
      this.fill();
      this.items().length;
      this.gridLayout();
      this.columnCount();
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
      this.#viewportWidth.set(el.clientWidth);
      this.#updateRange(el.scrollTop, height, this.rowCount(), this.itemSize());
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
    this.#viewportWidth.set(el.clientWidth);
    this.#updateRange(el.scrollTop, el.clientHeight, this.rowCount(), this.itemSize());
  }

  trackRow(_index: number, row: { cells: { item: T; index: number }[] }): unknown {
    return row.cells.map((cell) => this.trackBy()(cell.index, cell.item)).join('\0');
  }

  trackItem(index: number, item: T): unknown {
    return this.trackBy()(index, item);
  }

  #updateRange(scrollTop: number, viewportHeight: number, totalRows: number, itemSize: number): void {
    if (this.items().length <= this.threshold()) {
      this.rangeStart.set(0);
      this.rangeEnd.set(totalRows);
      return;
    }

    const buffer = this.bufferPx();
    const start = Math.max(0, Math.floor((scrollTop - buffer) / itemSize));
    const count = Math.ceil((viewportHeight + buffer * 2) / itemSize);
    const end = Math.min(totalRows, start + count);
    this.rangeStart.set(start);
    this.rangeEnd.set(end);
  }
}
