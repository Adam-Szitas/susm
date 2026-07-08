const DEFAULT_EDGE_THRESHOLD_PX = 72;
const DEFAULT_MAX_SPEED_PX = 18;

function canScrollVertically(element: HTMLElement): boolean {
  if (element.scrollHeight <= element.clientHeight + 1) {
    return false;
  }

  const { overflowY } = getComputedStyle(element);
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
}

function collectScrollableAncestors(anchor: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];
  let node: HTMLElement | null = anchor;

  while (node) {
    if (canScrollVertically(node)) {
      targets.push(node);
    }
    node = node.parentElement;
  }

  const root = document.scrollingElement as HTMLElement | null;
  if (root && canScrollVertically(root) && !targets.includes(root)) {
    targets.push(root);
  }

  return targets;
}

function scrollContainerRect(element: HTMLElement): DOMRect {
  if (element === document.documentElement || element === document.body) {
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }
  return element.getBoundingClientRect();
}

function verticalScrollDelta(
  clientY: number,
  element: HTMLElement,
  edgeThreshold: number,
  maxSpeed: number,
): number {
  const rect = scrollContainerRect(element);
  const distanceFromTop = clientY - rect.top;
  const distanceFromBottom = rect.bottom - clientY;

  if (distanceFromTop < edgeThreshold && distanceFromTop >= -edgeThreshold) {
    if (element.scrollTop <= 0) {
      return 0;
    }
    const intensity = 1 - Math.max(0, distanceFromTop) / edgeThreshold;
    return -maxSpeed * Math.max(intensity, 0.2);
  }

  if (distanceFromBottom < edgeThreshold && distanceFromBottom >= -edgeThreshold) {
    const maxScrollDown = element.scrollHeight - element.clientHeight - element.scrollTop;
    if (maxScrollDown <= 0) {
      return 0;
    }
    const intensity = 1 - Math.max(0, distanceFromBottom) / edgeThreshold;
    return maxSpeed * Math.max(intensity, 0.2);
  }

  return 0;
}

/** Auto-scrolls scrollable ancestors while dragging near the top/bottom edge. */
export class DragReorderAutoScroll {
  #rafId: number | null = null;
  #clientY = 0;
  #scrollTargets: HTMLElement[] = [];
  readonly #edgeThreshold: number;
  readonly #maxSpeed: number;

  constructor(
    edgeThreshold = DEFAULT_EDGE_THRESHOLD_PX,
    maxSpeed = DEFAULT_MAX_SPEED_PX,
  ) {
    this.#edgeThreshold = edgeThreshold;
    this.#maxSpeed = maxSpeed;
  }

  start(anchor: HTMLElement): void {
    this.stop();
    if (typeof window === 'undefined') {
      return;
    }
    this.#scrollTargets = collectScrollableAncestors(anchor);
  }

  update(clientY: number): void {
    if (!this.#scrollTargets.length || typeof window === 'undefined') {
      return;
    }
    this.#clientY = clientY;
    if (this.#rafId == null) {
      this.#rafId = requestAnimationFrame(() => this.#tick());
    }
  }

  stop(): void {
    if (this.#rafId != null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    this.#scrollTargets = [];
  }

  #tick(): void {
    this.#rafId = null;
    let scrolled = false;

    for (const target of this.#scrollTargets) {
      const delta = verticalScrollDelta(
        this.#clientY,
        target,
        this.#edgeThreshold,
        this.#maxSpeed,
      );
      if (delta !== 0) {
        target.scrollTop += delta;
        scrolled = true;
      }
    }

    if (scrolled) {
      this.#rafId = requestAnimationFrame(() => this.#tick());
    }
  }
}
