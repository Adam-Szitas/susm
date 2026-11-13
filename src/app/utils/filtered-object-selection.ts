import { computed, signal } from '@angular/core';
import { Object as ProjectObject } from '@models';

/** Selection always means live objects in the current filtered result, including virtual rows. */
export class FilteredObjectSelection {
  readonly active = signal(false);
  readonly #ids = signal(new Set<string>());
  readonly availableIds = computed(() =>
    this.objects()
      .filter((object) => !object.deleted_at && !!object._id?.$oid)
      .map((object) => object._id!.$oid),
  );
  readonly ids = computed(() => this.availableIds().filter((id) => this.#ids().has(id)));
  readonly count = computed(() => this.ids().length);
  readonly allSelected = computed(
    () => this.availableIds().length > 0 && this.count() === this.availableIds().length,
  );
  readonly indeterminate = computed(() => this.count() > 0 && !this.allSelected());

  constructor(private readonly objects: () => ProjectObject[]) {}

  enter(): void {
    this.#ids.set(new Set());
    this.active.set(true);
  }
  exit(): void {
    this.active.set(false);
    this.#ids.set(new Set());
  }
  has(id: string): boolean {
    return this.#ids().has(id) && this.availableIds().includes(id);
  }
  toggle(id: string): void {
    if (!this.active() || !this.availableIds().includes(id)) return;
    const next = new Set(this.ids());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.#ids.set(next);
  }
  toggleAll(): void {
    if (this.active()) this.#ids.set(new Set(this.allSelected() ? [] : this.availableIds()));
  }
  reconcile(): void {
    const visible = this.ids();
    if (this.#ids().size !== visible.length) this.#ids.set(new Set(visible));
  }
}
