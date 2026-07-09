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
import { sortObjectsByStoredOrder, formatObjectLabel } from '@models';
import { ModalService } from '@services/modal.service';
import { NotificationService } from '@services/notification.service';
import { TranslationService } from '@services/translation.service';
import { ImageCompressionService } from '@services/image-compression.service';
import { ProjectStore } from '@store/project.store';
import { IconComponent } from '@icons/icon.component';
import { icons } from '@icons/icon.definitions';
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

interface TrackedPointer {
  x: number;
  y: number;
}

interface PinchSession {
  pointerIds: [number, number];
  startDistance: number;
  startScale: number;
  startTx: number;
  startTy: number;
  startMidX: number;
  startMidY: number;
  viewportCenterX: number;
  viewportCenterY: number;
}

interface PinPixelPoint {
  x: number;
  y: number;
}

const MOVE_THRESHOLD_PX = 8;
const MIN_PINCH_DISTANCE_PX = 12;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

@Component({
  selector: 'app-project-plan-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, IconComponent],
  templateUrl: './project-plan-modal.component.html',
  styleUrl: './project-plan-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectPlanModalComponent {
  protected readonly icons = icons;
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
  #trackedPointers = new Map<number, TrackedPointer>();
  #pinchSession: PinchSession | null = null;
  #touchMoveCleanup: (() => void) | null = null;

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

      this.#touchMoveCleanup?.();
      const onTouchMove = (event: TouchEvent) => {
        if (this.pinPlacementActive()) {
          return;
        }
        if (event.touches.length >= 2 || this.#pinchSession) {
          event.preventDefault();
        }
      };
      viewport.addEventListener('touchmove', onTouchMove, { passive: false });
      this.#touchMoveCleanup = () => viewport.removeEventListener('touchmove', onTouchMove);

      return () => {
        this.#resizeObserver?.disconnect();
        this.#touchMoveCleanup?.();
        this.#touchMoveCleanup = null;
      };
    });
  }

  objectLabel(object: Object): string {
    return formatObjectLabel(object);
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
    if (event.pointerType === 'mouse' && event.button !== 0) {
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

    this.#trackedPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pinPlacementActive()) {
      if (this.#trackedPointers.size > 1) {
        this.#trackedPointers.delete(event.pointerId);
        return;
      }
      this.closePinMenu();
      this.#activePointer = {
        mode: 'place-pin',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTx: this.translateX(),
        startTy: this.translateY(),
        objectId: this.pinTargetObjectId() ?? '',
      };
      viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (this.#trackedPointers.size === 2) {
      this.#cancelSinglePointerInteraction(viewport);
      if (this.#startPinchSession()) {
        event.preventDefault();
      }
      return;
    }

    if (this.#trackedPointers.size > 2) {
      event.preventDefault();
      return;
    }

    this.closePinMenu();
    this.#activePointer = {
      mode: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTx: this.translateX(),
      startTy: this.translateY(),
      objectId: '',
    };
  }

  onViewportPointerMove(event: PointerEvent): void {
    this.#trackedPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (
      !this.#pinchSession &&
      !this.pinPlacementActive() &&
      this.#trackedPointers.size >= 2
    ) {
      this.#cancelSinglePointerInteraction(this.planViewport()?.nativeElement ?? document.body);
      this.#startPinchSession();
    }

    if (this.#pinchSession) {
      this.#updatePinch();
      event.preventDefault();
      return;
    }

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
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
      const viewport = this.planViewport()?.nativeElement;
      viewport?.setPointerCapture(event.pointerId);
    }
    this.translateX.set(active.startTx + dx);
    this.translateY.set(active.startTy + dy);
  }

  onViewportPointerUp(event: PointerEvent): void {
    this.#trackedPointers.delete(event.pointerId);

    if (this.#pinchSession) {
      const [idA, idB] = this.#pinchSession.pointerIds;
      if (!this.#trackedPointers.has(idA) || !this.#trackedPointers.has(idB)) {
        this.#pinchSession = null;
      }
      if (this.#pinchSession) {
        event.preventDefault();
        return;
      }
    }

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
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.stopPropagation();

    this.#pinchSession = null;
    this.#trackedPointers.clear();
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
    this.scale.update((s) => Math.min(MAX_SCALE, +(s + 0.25).toFixed(2)));
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(MIN_SCALE, +(s - 0.25).toFixed(2)));
  }

  resetView(): void {
    this.scale.set(1);
    this.translateX.set(0);
    this.translateY.set(0);
    this.#pinchSession = null;
    this.#trackedPointers.clear();
  }

  onWheel(event: WheelEvent): void {
    if (this.pinTargetObjectId()) {
      return;
    }
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.15 : 0.15;
    this.scale.update((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));
  }

  #cancelSinglePointerInteraction(viewport: HTMLElement): void {
    if (this.#activePointer) {
      try {
        viewport.releasePointerCapture(this.#activePointer.pointerId);
      } catch {
        // Pointer may already be released.
      }
    }
    this.#activePointer = null;
    this.dragPreviewPosition.set(null);
  }

  #startPinchSession(): boolean {
    const ids = [...this.#trackedPointers.keys()];
    if (ids.length < 2) {
      return false;
    }
    const p1 = this.#trackedPointers.get(ids[0]);
    const p2 = this.#trackedPointers.get(ids[1]);
    const viewport = this.planViewport()?.nativeElement;
    if (!p1 || !p2 || !viewport) {
      return false;
    }

    const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (distance < MIN_PINCH_DISTANCE_PX) {
      return false;
    }

    const rect = viewport.getBoundingClientRect();
    this.closePinMenu();
    this.#pinchSession = {
      pointerIds: [ids[0], ids[1]],
      startDistance: distance,
      startScale: this.scale(),
      startTx: this.translateX(),
      startTy: this.translateY(),
      startMidX: (p1.x + p2.x) / 2,
      startMidY: (p1.y + p2.y) / 2,
      viewportCenterX: rect.left + rect.width / 2,
      viewportCenterY: rect.top + rect.height / 2,
    };
    return true;
  }

  #updatePinch(): void {
    const session = this.#pinchSession;
    if (!session) {
      return;
    }

    const p1 = this.#trackedPointers.get(session.pointerIds[0]);
    const p2 = this.#trackedPointers.get(session.pointerIds[1]);
    if (!p1 || !p2) {
      return;
    }

    const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (distance < 1) {
      return;
    }

    const ratio = distance / session.startDistance;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(session.startScale * ratio).toFixed(3)));
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const midDx = midX - session.startMidX;
    const midDy = midY - session.startMidY;
    const focalOffsetX = session.startMidX - session.viewportCenterX;
    const focalOffsetY = session.startMidY - session.viewportCenterY;
    const scaleRatio = newScale / session.startScale;

    this.scale.set(newScale);
    this.translateX.set(+(session.startTx + midDx + focalOffsetX * (1 - scaleRatio)).toFixed(2));
    this.translateY.set(+(session.startTy + midDy + focalOffsetY * (1 - scaleRatio)).toFixed(2));
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
