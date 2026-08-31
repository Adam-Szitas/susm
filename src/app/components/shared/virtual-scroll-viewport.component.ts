import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  TemplateRef,
  afterRenderEffect,
  computed,
  contentChild,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  rowOffsetPrefix,
  visibleRowRange,
} from './virtual-scroll-layout';

/** Below this count, render all items (no virtual scroll overhead). */
export const VIRTUAL_SCROLL_DEFAULT_THRESHOLD = 50;

/** Horizontal gap between grid cells — keep in sync with `.virtual-scroll-item--grid`. */
const GRID_GAP_PX = 8;

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
  #ngZone = inject(NgZone);

  readonly itemTemplate = contentChild(TemplateRef);

  readonly viewportRef = viewChild<ElementRef<HTMLElement>>('viewport');
  readonly contentRef = viewChild<ElementRef<HTMLElement>>('content');

  /** Full data set (virtual scroll slices this). */
  items = input.required<T[]>();
  /** Estimated row height in px until a row is measured. */
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
  readonly #metricsVersion = signal(0);

  /** Measured pixel height per row index. Missing entries use {@link itemSize}. */
  #rowHeights: Array<number | undefined> = [];
  #prefix: number[] = [0];

  readonly useVirtualScroll = computed(
    () =>
      this.items().length > this.threshold() && (!this.gridLayout() || this.fill()),
  );

  readonly columnCount = computed(() => {
    if (!this.gridLayout()) {
      return 1;
    }

    const minWidth = this.gridMinColumnWidth();
    const width = this.#viewportWidth();
    return Math.max(1, Math.floor((width + GRID_GAP_PX) / (minWidth + GRID_GAP_PX)));
  });

  readonly rowCount = computed(() => {
    const total = this.items().length;
    if (!this.gridLayout()) {
      return total;
    }
    return Math.ceil(total / this.columnCount());
  });

  readonly totalHeight = computed(() => {
    this.#metricsVersion();
    const n = this.rowCount();
    return this.#prefix[n] ?? n * this.itemSize();
  });

  readonly transform = computed(() => {
    this.#metricsVersion();
    const start = this.rangeStart();
    const y = this.#prefix[start] ?? start * this.itemSize();
    return `translate3d(0, ${y}px, 0)`;
  });

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
      this.items();
      this.columnCount();
      this.gridLayout();
      this.itemSize();
      untracked(() => this.#resetRowMetrics());
    });

    effect(() => {
      this.#metricsVersion();
      const total = this.rowCount();
      const viewportHeight = this.#viewportHeight();
      this.#updateRange(this.#scrollTop(), viewportHeight, total);
    });

    effect(() => {
      if (!this.useVirtualScroll()) return;
      this.fill();
      this.items().length;
      this.gridLayout();
      this.columnCount();
      queueMicrotask(() => this.#measureViewport());
    });

    afterRenderEffect(() => {
      if (!this.useVirtualScroll()) {
        return;
      }
      this.visibleRows();
      untracked(() => {
        this.#observeRowNodes();
        this.#measureVisibleRows();
      });
    });
  }

  ngAfterViewInit(): void {
    this.#measureViewport();
  }

  #resetRowMetrics(): void {
    this.#rowHeights = [];
    this.#rebuildPrefix();
  }

  #rebuildPrefix(): void {
    this.#prefix = rowOffsetPrefix(this.rowCount(), this.itemSize(), this.#rowHeights);
    this.#metricsVersion.update((version) => version + 1);
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
      this.#updateRange(el.scrollTop, height, this.rowCount());
    };

    sync();

    if (!this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver(() => sync());
      this.#resizeObserver.observe(el);
      this.#resizeObserver.observe(this.#host.nativeElement);
      this.#destroyRef.onDestroy(() => {
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = undefined;
        this.#rowResizeObserver?.disconnect();
        this.#rowResizeObserver = undefined;
      });
    }
  }

  #resizeObserver?: ResizeObserver;
  #rowResizeObserver?: ResizeObserver;

  #observeRowNodes(): void {
    const root = this.contentRef()?.nativeElement;
    if (!root || typeof ResizeObserver === 'undefined') {
      return;
    }

    if (!this.#rowResizeObserver) {
      this.#rowResizeObserver = new ResizeObserver(() => {
        this.#ngZone.run(() => this.#measureVisibleRows());
      });
    }

    this.#rowResizeObserver.disconnect();
    for (const node of root.querySelectorAll(':scope > .virtual-scroll-item')) {
      this.#rowResizeObserver.observe(node);
    }
  }

  #measureVisibleRows(): void {
    const root = this.contentRef()?.nativeElement;
    if (!root) {
      return;
    }

    const start = this.rangeStart();
    const nodes = root.querySelectorAll(':scope > .virtual-scroll-item');
    let changed = false;

    nodes.forEach((node, index) => {
      const row = start + index;
      const height = Math.round((node as HTMLElement).getBoundingClientRect().height);
      if (height < 1 || this.#rowHeights[row] === height) {
        return;
      }
      this.#rowHeights[row] = height;
      changed = true;
    });

    if (changed) {
      this.#rebuildPrefix();
    }
  }

  onScroll(): void {
    const el = this.viewportRef()?.nativeElement;
    if (!el) return;
    this.#scrollTop.set(el.scrollTop);
    this.#viewportHeight.set(el.clientHeight);
    this.#viewportWidth.set(el.clientWidth);
    this.#updateRange(el.scrollTop, el.clientHeight, this.rowCount());
  }

  trackRow(_index: number, row: { cells: { item: T; index: number }[] }): unknown {
    return row.cells.map((cell) => this.trackBy()(cell.index, cell.item)).join('\0');
  }

  trackItem(index: number, item: T): unknown {
    return this.trackBy()(index, item);
  }

  #updateRange(scrollTop: number, viewportHeight: number, totalRows: number): void {
    if (this.items().length <= this.threshold()) {
      this.rangeStart.set(0);
      this.rangeEnd.set(totalRows);
      return;
    }

    const { start, end } = visibleRowRange(
      scrollTop,
      viewportHeight,
      this.bufferPx(),
      totalRows,
      this.#prefix,
    );
    this.rangeStart.set(start);
    this.rangeEnd.set(end);
  }
}
