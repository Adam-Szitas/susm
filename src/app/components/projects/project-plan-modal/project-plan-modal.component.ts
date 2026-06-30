import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import type { Object } from '@models';
import { sortObjectsByStoredOrder } from '@models';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ImageCompressionService } from '@services/image-compression.service';
import { ProjectStore } from '@store/project.store';
import { buildUploadImageUrl } from '../../../utils/upload-image-url';

type PointerMode = 'pan' | 'place-pin' | 'drag-pin';

interface ActivePointer {
  mode: PointerMode;
  pointerId: number;
  startX: number;
  startY: number;
  startTx: number;
  startTy: number;
  objectId: string;
}

interface PinPixelPoint {
  x: number;
  y: number;
}

const MOVE_THRESHOLD_PX = 8;

@Component({
  selector: 'app-project-plan-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './project-plan-modal.component.html',
  styleUrl: './project-plan-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectPlanModalComponent {
  #modalService = inject(ModalService);
  #router = inject(Router);
  #notificationService = inject(NotificationService);
  #translationService = inject(TranslationService);
  #imageCompression = inject(ImageCompressionService);
  #projectStore = inject(ProjectStore);
  #overlayLayoutFrame: number | null = null;
  #resizeObserver: ResizeObserver | null = null;

  projectId = input.required<string>();

  readonly planImage = viewChild<ElementRef<HTMLImageElement>>('planImage');
  readonly planViewport = viewChild<ElementRef<HTMLElement>>('planViewport');
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  uploading = signal(false);
  savingPin = signal(false);
  droppingPlan = signal(false);
  dropPlanConfirmOpen = signal(false);
  scale = signal(1);
  translateX = signal(0);
  translateY = signal(0);
  pinTargetObjectId = signal<string | null>(null);
  selectedPinObjectId = signal<string | null>(null);
  /** Screen-space pin positions relative to the viewport (updated on pan/zoom/layout). */
  pinOverlayPositions = signal<Record<string, PinPixelPoint>>({});
  /** Bumps when the plan image is replaced so the browser reloads even if path is unchanged. */
  planImageRevision = signal(0);
  /** Live drag position before save. */
  dragPreviewPosition = signal<(PinPixelPoint & { objectId: string }) | null>(null);

  #activePointer: ActivePointer | null = null;

  streetPlan = computed(() => this.#projectStore.project()?.street_plan ?? null);
  objects = computed(() => sortObjectsByStoredOrder(this.#projectStore.objects()));

  planImageUrl = computed(() => {
    const plan = this.streetPlan();
    if (!plan?.path) {
      return '';
    }
    const base = buildUploadImageUrl(plan.path);
    const version = plan.updated_at
      ? new Date(plan.updated_at).getTime()
      : this.planImageRevision();
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}v=${version}`;
  });

  pinnedObjects = computed(() =>
    this.objects().filter((o) => o.map_pin && o._id?.$oid && !o.deleted_at),
  );

  selectedPinObject = computed(() => {
    const id = this.selectedPinObjectId();
    if (!id) return null;
    return this.pinnedObjects().find((o) => o._id?.$oid === id) ?? null;
  });

  unpinnedObjects = computed(() =>
    this.objects().filter((o) => !o.map_pin && o._id?.$oid && !o.deleted_at),
  );

  hasPlan = computed(() => !!this.streetPlan()?.path);
  pinPlacementActive = computed(() => !!this.pinTargetObjectId());

  transformStyle = computed(
    () =>
      `translate(${this.translateX()}px, ${this.translateY()}px) scale(${this.scale()})`,
  );

  constructor() {
    effect(() => {
      this.scale();
      this.translateX();
      this.translateY();
      this.pinnedObjects();
      this.planImageUrl();
      this.planImageRevision();
      this.#scheduleOverlayLayout();
    });

    effect(() => {
      const viewport = this.planViewport()?.nativeElement;
      if (!viewport) {
        return;
      }
      this.#resizeObserver?.disconnect();
      this.#resizeObserver = new ResizeObserver(() => this.#scheduleOverlayLayout());
      this.#resizeObserver.observe(viewport);
      return () => this.#resizeObserver?.disconnect();
    });
  }

  objectLabel(object: Object): string {
    const addr = object.address;
    const parts = [addr?.house_number, addr?.level, addr?.door_number]
      .map((p) => p?.trim())
      .filter(Boolean);
    return parts.join(', ') || object._id?.$oid || '';
  }

  pinPixelPosition(object: Object): PinPixelPoint | null {
    const id = object._id?.$oid;
    if (!id) return null;
    const preview = this.dragPreviewPosition();
    if (preview?.objectId === id) {
      return { x: preview.x, y: preview.y };
    }
    return this.pinOverlayPositions()[id] ?? null;
  }

  menuPixelPosition(): PinPixelPoint | null {
    const id = this.selectedPinObjectId();
    if (!id) return null;
    const preview = this.dragPreviewPosition();
    const base =
      preview?.objectId === id ? preview : this.pinOverlayPositions()[id];
    if (!base) return null;
    return { x: base.x, y: base.y + 12 };
  }

  onPlanImageLoad(): void {
    this.#scheduleOverlayLayout();
  }

  triggerUpload(): void {
    this.dropPlanConfirmOpen.set(false);
    this.fileInput()?.nativeElement?.click();
  }

  requestDropPlan(): void {
    this.dropPlanConfirmOpen.set(true);
  }

  cancelDropPlan(): void {
    this.dropPlanConfirmOpen.set(false);
  }

  confirmDropPlan(): void {
    if (this.droppingPlan()) {
      return;
    }
    this.droppingPlan.set(true);
    this.#projectStore
      .clearStreetPlan(this.projectId())
      .pipe(finalize(() => this.droppingPlan.set(false)))
      .subscribe({
        next: () => {
          this.dropPlanConfirmOpen.set(false);
          this.closePinMenu();
          this.clearPinTarget();
          this.resetView();
          this.#notificationService.showSuccess(
            this.#translationService.instant('projectPlan.dropPlanSuccess'),
          );
        },
        error: (err) => {
          this.#notificationService.showError(
            err.message || this.#translationService.instant('projectPlan.dropPlanFailed'),
          );
        },
      });
  }

  async onPlanFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.#imageCompression.isImageFile(file)) {
      this.#notificationService.showError(
        this.#translationService.instant('projectPlan.imageOnly'),
      );
      return;
    }

    this.uploading.set(true);
    try {
      const [compressed] = await this.#imageCompression.compressImages([file]);
      this.#projectStore
        .uploadStreetPlan(this.projectId(), compressed)
        .pipe(finalize(() => this.uploading.set(false)))
        .subscribe({
          next: () => {
            this.planImageRevision.update((n) => n + 1);
            this.pinOverlayPositions.set({});
            this.resetView();
            this.#notificationService.showSuccess(
              this.#translationService.instant('projectPlan.uploadSuccess'),
            );
          },
          error: (err) => {
            this.#notificationService.showError(
              err.message || this.#translationService.instant('projectPlan.uploadFailed'),
            );
          },
        });
    } catch {
      this.uploading.set(false);
      this.#notificationService.showError(
        this.#translationService.instant('errors.imageCompressionFailed'),
      );
    }
  }

  onPinTargetChange(objectId: string): void {
    this.pinTargetObjectId.set(objectId?.trim() || null);
    this.selectedPinObjectId.set(null);
  }

  clearPinTarget(): void {
    this.pinTargetObjectId.set(null);
  }

  togglePinMenu(objectId: string | null): void {
    if (!objectId) return;
    this.pinTargetObjectId.set(null);
    this.selectedPinObjectId.update((current) => (current === objectId ? null : objectId));
  }

  closePinMenu(): void {
    this.selectedPinObjectId.set(null);
  }

  onViewportPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest('.plan-pin')) {
      return;
    }
    if ((event.target as HTMLElement).closest('.plan-pin-menu')) {
      return;
    }

    const viewport = this.planViewport()?.nativeElement;
    if (!viewport) {
      return;
    }

    this.closePinMenu();
    const pinTarget = this.pinTargetObjectId();

    this.#activePointer = {
      mode: pinTarget ? 'place-pin' : 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTx: this.translateX(),
      startTy: this.translateY(),
      objectId: pinTarget ?? '',
    };

    viewport.setPointerCapture(event.pointerId);
    if (pinTarget) {
      event.preventDefault();
    }
  }

  onViewportPointerMove(event: PointerEvent): void {
    const active = this.#activePointer;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }

    if (active.mode === 'place-pin') {
      return;
    }

    if (active.mode === 'drag-pin') {
      const moved =
        Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >
        MOVE_THRESHOLD_PX;
      if (!moved) {
        return;
      }
      const viewport = this.planViewport()?.nativeElement;
      if (viewport && !viewport.hasPointerCapture(event.pointerId)) {
        viewport.setPointerCapture(event.pointerId);
      }
      const coords = this.#clientToPlanPercent(event.clientX, event.clientY);
      const img = this.planImage()?.nativeElement;
      if (coords && viewport && img) {
        const vpRect = viewport.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const pixel = this.#percentToViewportPixel(coords.x, coords.y, vpRect, imgRect);
        this.dragPreviewPosition.set({ objectId: active.objectId, ...pixel });
      }
      return;
    }

    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    this.translateX.set(active.startTx + dx);
    this.translateY.set(active.startTy + dy);
  }

  onViewportPointerUp(event: PointerEvent): void {
    const active = this.#activePointer;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }

    this.#releasePointerCapture(event);

    const moved =
      Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >
      MOVE_THRESHOLD_PX;

    if (active.mode === 'place-pin' && !moved && active.objectId) {
      this.#placePinFromClientCoords(active.objectId, event.clientX, event.clientY);
    }

    if (active.mode === 'drag-pin' && active.objectId) {
      const dragMoved =
        Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >
        MOVE_THRESHOLD_PX;
      if (dragMoved) {
        this.#placePinFromClientCoords(active.objectId, event.clientX, event.clientY, {
          silent: true,
        });
      } else {
        this.togglePinMenu(active.objectId);
      }
    }

    this.dragPreviewPosition.set(null);
    this.#activePointer = null;
    this.#scheduleOverlayLayout();
  }

  onPinPointerDown(event: PointerEvent, objectId: string): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();

    this.pinTargetObjectId.set(null);

    this.#activePointer = {
      mode: 'drag-pin',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTx: this.translateX(),
      startTy: this.translateY(),
      objectId,
    };
  }

  openObject(objectId: string, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.closePinMenu();
    void this.#router.navigate(['/objects/tab', objectId]).then((ok) => {
      if (ok) {
        this.#modalService.close();
      }
    });
  }

  removeFromPlan(objectId: string, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.savingPin()) {
      return;
    }
    this.closePinMenu();
    this.savingPin.set(true);
    this.#projectStore
      .updateObjectMapPin(objectId, null)
      .pipe(finalize(() => this.savingPin.set(false)))
      .subscribe({
        next: () => {
          this.#scheduleOverlayLayout();
          this.#notificationService.showSuccess(
            this.#translationService.instant('projectPlan.pinRemoved'),
          );
        },
        error: (err) => {
          this.#notificationService.showError(
            err.message || this.#translationService.instant('projectPlan.pinRemoveFailed'),
          );
        },
      });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.dropPlanConfirmOpen()) {
      this.cancelDropPlan();
      return;
    }
    if (this.selectedPinObjectId()) {
      this.closePinMenu();
      return;
    }
    if (this.pinTargetObjectId()) {
      this.clearPinTarget();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.#scheduleOverlayLayout();
  }

  zoomIn(): void {
    this.scale.update((s) => Math.min(4, +(s + 0.25).toFixed(2)));
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
  }

  resetView(): void {
    this.scale.set(1);
    this.translateX.set(0);
    this.translateY.set(0);
  }

  onWheel(event: WheelEvent): void {
    if (this.pinTargetObjectId()) {
      return;
    }
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.15 : 0.15;
    this.scale.update((s) => Math.min(4, Math.max(0.5, +(s + delta).toFixed(2))));
  }

  #scheduleOverlayLayout(): void {
    if (this.#overlayLayoutFrame != null) {
      cancelAnimationFrame(this.#overlayLayoutFrame);
    }
    this.#overlayLayoutFrame = requestAnimationFrame(() => {
      this.#overlayLayoutFrame = null;
      this.#updateOverlayLayout();
    });
  }

  #updateOverlayLayout(): void {
    const viewport = this.planViewport()?.nativeElement;
    const img = this.planImage()?.nativeElement;
    if (!viewport || !img || !img.complete) {
      return;
    }

    const vpRect = viewport.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    if (imgRect.width <= 0 || imgRect.height <= 0) {
      return;
    }

    const positions: Record<string, PinPixelPoint> = {};
    for (const obj of this.pinnedObjects()) {
      const pin = obj.map_pin;
      const id = obj._id?.$oid;
      if (!pin || !id) continue;
      positions[id] = this.#percentToViewportPixel(pin.x, pin.y, vpRect, imgRect);
    }
    this.pinOverlayPositions.set(positions);
  }

  #percentToViewportPixel(
    xPct: number,
    yPct: number,
    vpRect: DOMRect,
    imgRect: DOMRect,
  ): PinPixelPoint {
    return {
      x: imgRect.left - vpRect.left + (xPct / 100) * imgRect.width,
      y: imgRect.top - vpRect.top + (yPct / 100) * imgRect.height,
    };
  }

  #releasePointerCapture(event: PointerEvent): void {
    try {
      (event.currentTarget as HTMLElement)?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released.
    }
  }

  #placePinFromClientCoords(
    objectId: string,
    clientX: number,
    clientY: number,
    options?: { silent?: boolean },
  ): void {
    const coords = this.#clientToPlanPercent(clientX, clientY);
    if (!coords) {
      if (!options?.silent) {
        this.#notificationService.showError(
          this.#translationService.instant('projectPlan.clickOnImage'),
        );
      }
      return;
    }
    this.#savePin(objectId, coords);
  }

  #clientToPlanPercent(clientX: number, clientY: number): { x: number; y: number } | null {
    const img = this.planImage()?.nativeElement;
    if (!img) {
      return null;
    }
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(100, Math.max(0, +x.toFixed(3))),
      y: Math.min(100, Math.max(0, +y.toFixed(3))),
    };
  }

  #savePin(objectId: string, coords: { x: number; y: number }): void {
    if (this.savingPin()) {
      return;
    }
    this.savingPin.set(true);
    this.#projectStore
      .updateObjectMapPin(objectId, coords)
      .pipe(finalize(() => this.savingPin.set(false)))
      .subscribe({
        next: () => {
          this.pinTargetObjectId.set(null);
          this.dragPreviewPosition.set(null);
          this.#scheduleOverlayLayout();
          this.#notificationService.showSuccess(
            this.#translationService.instant('projectPlan.pinSaved'),
          );
        },
        error: (err) => {
          this.#notificationService.showError(
            err.message || this.#translationService.instant('projectPlan.pinSaveFailed'),
          );
        },
      });
  }
}
