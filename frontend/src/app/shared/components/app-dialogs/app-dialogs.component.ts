import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../../core/services/dialog.service';
import { ProxyImageDirective } from '../../directives/proxy-image.directive';

@Component({
  selector: 'app-dialogs',
  standalone: true,
  imports: [CommonModule, ProxyImageDirective],
  template: `
    <!-- Confirm Dialog -->
    <div *ngIf="dialog.confirmDialog().open" class="c-overlay" style="z-index: 99999;">
      <div class="c-overlay-bg" (click)="dialog.closeConfirm()"></div>
      <div class="c-panel" style="width: min(400px, 90vw); border-radius: 22px; overflow: hidden;">
        <div style="padding: 32px 28px; text-align: center;">
          <div style="width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;" [style.background]="dialog.confirmDialog().iconColor + '18'">
            <i [class]="dialog.confirmDialog().icon" style="font-size: 26px;" [style.color]="dialog.confirmDialog().iconColor"></i>
          </div>
          <h3 style="margin: 0 0 10px 0; font-weight: bold; font-size: 19px; color: var(--ion-text-color);">{{ dialog.confirmDialog().title }}</h3>
          <p [style.margin]="dialog.confirmDialog().details?.length ? '0 0 16px 0' : '0 0 28px 0'" style="font-size: 14px; color: gray; line-height: 1.5;">{{ dialog.confirmDialog().message }}</p>
          <div *ngIf="dialog.confirmDialog().details?.length" style="text-align: left; background: var(--ion-color-light, #f4f5f8); border-radius: 12px; padding: 4px 14px; margin-bottom: 20px;">
            <div *ngFor="let d of dialog.confirmDialog().details; let isLast = last" style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--ion-color-step-100, #e6e6e6);" [style.border-bottom]="isLast ? 'none' : ''">
              <i *ngIf="d.icon" [class]="d.icon" style="font-size: 13px; color: var(--ion-color-medium); width: 16px; flex-shrink: 0;"></i>
              <span style="font-size: 12px; font-weight: 700; color: var(--ion-color-medium); flex-shrink: 0;">{{ d.label }}</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--ion-text-color); text-align: right; flex: 1; overflow-wrap: anywhere;">{{ d.value }}</span>
            </div>
          </div>
          <div style="display: flex; gap: 10px;">
            <button (click)="dialog.closeConfirm()" [disabled]="dialog.confirmLoading()" [style.opacity]="dialog.confirmLoading() ? 0.5 : 1" [style.cursor]="dialog.confirmLoading() ? 'not-allowed' : 'pointer'" style="flex: 1; padding: 14px; background: var(--ion-color-light); border: none; border-radius: 12px; font-size: 15px; font-weight: bold; color: var(--ion-text-color);">{{ dialog.confirmDialog().cancelLabel }}</button>
            <button (click)="dialog.runConfirm()" [disabled]="dialog.confirmLoading()" style="flex: 1; padding: 14px; border: none; border-radius: 12px; font-size: 15px; font-weight: bold; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center;" [style.background]="dialog.confirmDialog().confirmColor" [style.cursor]="dialog.confirmLoading() ? 'not-allowed' : 'pointer'">
              <ng-container *ngIf="!dialog.confirmLoading()">{{ dialog.confirmDialog().confirmLabel }}</ng-container>
              <span *ngIf="dialog.confirmLoading()" class="dot-loader"><span></span><span></span><span></span></span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Enhanced Responsive Media Lightbox (Zoomable, Pinchable, Swipeable Gallery) -->
    <div *ngIf="dialog.lightboxOpen()"
         class="lightbox-overlay"
         [style.opacity]="backdropOpacity"
         (click)="onBackdropClick($event)">

      <!-- Top Toolbar (Counter, Zoom Tools, Close) -->
      <div class="lightbox-toolbar" (click)="$event.stopPropagation()">
        <!-- Counter Badge (for multiple images) -->
        <div class="lightbox-counter" *ngIf="dialog.totalMediaCount > 1">
          <i class="fa-solid fa-images" style="margin-right: 6px; font-size: 11px;"></i>
          <span>{{ dialog.lightboxIndex() + 1 }} / {{ dialog.totalMediaCount }}</span>
        </div>
        <div *ngIf="dialog.totalMediaCount <= 1"></div>

        <!-- Controls: Zoom In, Zoom Out, Reset, Close -->
        <div class="lightbox-tools">
          <ng-container *ngIf="!dialog.lightboxIsVideo()">
            <button type="button" class="lightbox-tool-btn" (click)="zoomOut()" [disabled]="scale <= 1" title="Zoom Out">
              <i class="fa-solid fa-magnifying-glass-minus"></i>
            </button>
            <button type="button" class="lightbox-tool-btn" (click)="zoomIn()" [disabled]="scale >= 4" title="Zoom In">
              <i class="fa-solid fa-magnifying-glass-plus"></i>
            </button>
            <button type="button" class="lightbox-tool-btn" *ngIf="scale > 1" (click)="resetZoom()" title="Reset Zoom">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
          </ng-container>

          <button type="button" class="lightbox-close-btn" (click)="closeLightbox()" title="Close Viewer">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Main Media Stage -->
      <div class="lightbox-stage"
           (touchstart)="onTouchStart($event)"
           (touchmove)="onTouchMove($event)"
           (touchend)="onTouchEnd($event)"
           (wheel)="onWheel($event)"
           (dblclick)="onDoubleTap($event)">

        <div class="lightbox-media-wrapper"
             [style.transform]="transformStyle"
             [style.transition]="isPinching || isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)'">

          <!-- Video Player -->
          <video *ngIf="dialog.lightboxIsVideo()"
                 class="lightbox-video"
                 [proxySrc]="dialog.lightboxUrl()"
                 controls
                 autoplay
                 playsinline
                 (click)="$event.stopPropagation()">
          </video>

          <!-- Image Viewer -->
          <img *ngIf="!dialog.lightboxIsVideo()"
               class="lightbox-img"
               [proxySrc]="dialog.lightboxUrl()"
               draggable="false"
               alt="Media preview"
               (click)="$event.stopPropagation()" />
        </div>
      </div>

      <!-- Left / Right Navigation Arrow Buttons (Desktop & Tablet) -->
      <button *ngIf="dialog.hasPrevMedia"
              type="button"
              class="lightbox-nav-btn lightbox-nav-prev"
              (click)="prevMedia($event)"
              title="Previous Photo">
        <i class="fa-solid fa-chevron-left"></i>
      </button>

      <button *ngIf="dialog.hasNextMedia"
              type="button"
              class="lightbox-nav-btn lightbox-nav-next"
              (click)="nextMedia($event)"
              title="Next Photo">
        <i class="fa-solid fa-chevron-right"></i>
      </button>

      <!-- Bottom Gallery Dots Indicator & Gesture Hints -->
      <div class="lightbox-footer" (click)="$event.stopPropagation()">
        <!-- Dots for multiple media -->
        <div class="lightbox-dots" *ngIf="dialog.totalMediaCount > 1">
          <span *ngFor="let item of dialog.lightboxItems(); let i = index"
                class="lightbox-dot"
                [class.active]="i === dialog.lightboxIndex()"
                (click)="goToIndex(i)">
          </span>
        </div>
        <p class="lightbox-hint">
          <span *ngIf="!dialog.lightboxIsVideo()"><i class="fa-solid fa-hand-pointer" style="margin-right: 4px;"></i>Double-tap or pinch to zoom</span>
          <span *ngIf="dialog.totalMediaCount > 1" style="margin-left: 8px;">• <i class="fa-solid fa-arrows-left-right" style="margin: 0 4px;"></i>Swipe to navigate</span>
        </p>
      </div>

    </div>
  `,
})
export class AppDialogsComponent {
  scale = 1;
  panX = 0;
  panY = 0;
  dragX = 0;
  dragY = 0;

  isPinching = false;
  isSwiping = false;

  private startX = 0;
  private startY = 0;
  private initialPanX = 0;
  private initialPanY = 0;
  private touchDistance = 0;
  private initialScale = 1;
  private lastTap = 0;

  constructor(public dialog: DialogService) {}

  get transformStyle(): string {
    return `translate3d(${this.panX + this.dragX}px, ${this.panY + this.dragY}px, 0px) scale(${this.scale})`;
  }

  get backdropOpacity(): number {
    if (this.dragY > 0) {
      return Math.max(0.3, 1 - this.dragY / 350);
    }
    return 1;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (!this.dialog.lightboxOpen()) return;
    if (event.key === 'Escape') {
      this.closeLightbox();
    } else if (event.key === 'ArrowRight' && this.dialog.hasNextMedia) {
      this.nextMedia();
    } else if (event.key === 'ArrowLeft' && this.dialog.hasPrevMedia) {
      this.prevMedia();
    }
  }

  onBackdropClick(event: MouseEvent) {
    if (this.scale <= 1.05) {
      this.closeLightbox();
    } else {
      this.resetZoom();
    }
  }

  private lastDoubleTapTime = 0;

  onDoubleTap(event: MouseEvent | TouchEvent) {
    if (this.dialog.lightboxIsVideo()) return;
    const now = Date.now();
    // Ignore synthetic dblclick dispatched by browser within 400ms of a touch double-tap
    if (now - this.lastDoubleTapTime < 400) return;
    this.lastDoubleTapTime = now;

    if (this.scale > 1.1) {
      this.resetZoom();
    } else {
      this.scale = 2.5;
      this.panX = 0;
      this.panY = 0;
      this.dragX = 0;
      this.dragY = 0;
    }
  }

  onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      this.isPinching = true;
      this.isSwiping = false;
      this.touchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      this.initialScale = this.scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - this.lastTap < 300) {
        this.onDoubleTap(e);
        this.lastTap = 0;
        return;
      }
      this.lastTap = now;

      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
      this.initialPanX = this.panX;
      this.initialPanY = this.panY;
      this.isSwiping = true;
    }
  }

  onTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && this.isPinching) {
      if (e.cancelable) e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (this.touchDistance > 0) {
        const factor = dist / this.touchDistance;
        this.scale = Math.max(1, Math.min(4, +(this.initialScale * factor).toFixed(2)));
      }
    } else if (e.touches.length === 1 && this.isSwiping) {
      const dx = e.touches[0].clientX - this.startX;
      const dy = e.touches[0].clientY - this.startY;

      if (this.scale > 1.05) {
        // Free panning while zoomed in
        if (e.cancelable) e.preventDefault();
        this.panX = this.initialPanX + dx;
        this.panY = this.initialPanY + dy;
      } else {
        // Drag gestures at normal scale:
        if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
          // Drag down to dismiss
          if (e.cancelable) e.preventDefault();
          this.dragY = dy;
          this.dragX = 0;
        } else if (Math.abs(dx) >= Math.abs(dy)) {
          // Horizontal dragging
          if (e.cancelable) e.preventDefault();
          this.dragY = 0;

          if (this.dialog.totalMediaCount > 1) {
            // Check boundary conditions:
            const isAtStartBoundary = dx > 0 && !this.dialog.hasPrevMedia; // pulling right on 1st item
            const isAtEndBoundary   = dx < 0 && !this.dialog.hasNextMedia; // pulling left on last item

            if (isAtStartBoundary || isAtEndBoundary) {
              // Elastic rubber-band resistance on both ends of the list
              this.dragX = dx * 0.25;
            } else {
              // Direct responsive drag between valid adjacent images
              this.dragX = dx;
            }
          } else {
            // Single image: elastic rubber-band resistance in both directions
            this.dragX = dx * 0.25;
          }
        }
      }
    }
  }

  onTouchEnd(e: TouchEvent) {
    if (this.isPinching) {
      this.isPinching = false;
      if (this.scale < 1.05) {
        this.resetZoom();
      }
      return;
    }

    if (this.isSwiping) {
      this.isSwiping = false;

      // Vertical drag down to dismiss (threshold: 90px)
      if (this.dragY > 90) {
        this.closeLightbox();
        return;
      }

      // Horizontal swipe navigation if multiple items exist and not at boundary (threshold: 55px)
      if (this.scale <= 1.05 && this.dialog.totalMediaCount > 1) {
        if (this.dragX < -55 && this.dialog.hasNextMedia) {
          this.nextMedia();
          return;
        } else if (this.dragX > 55 && this.dialog.hasPrevMedia) {
          this.prevMedia();
          return;
        }
      }

      // Always snap back smoothly to center (for boundaries, single images, or sub-threshold drags)
      this.dragX = 0;
      this.dragY = 0;
    }
  }

  onWheel(e: WheelEvent) {
    if (this.dialog.lightboxIsVideo()) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    this.scale = Math.max(1, Math.min(4, +(this.scale + delta).toFixed(2)));
    if (this.scale <= 1) this.resetZoom();
  }

  zoomIn() {
    this.scale = Math.min(4, +(this.scale + 0.5).toFixed(1));
  }

  zoomOut() {
    this.scale = Math.max(1, +(this.scale - 0.5).toFixed(1));
    if (this.scale <= 1) this.resetZoom();
  }

  resetZoom() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.dragX = 0;
    this.dragY = 0;
  }

  nextMedia(event?: MouseEvent) {
    event?.stopPropagation();
    this.resetZoom();
    this.dialog.nextLightboxItem();
  }

  prevMedia(event?: MouseEvent) {
    event?.stopPropagation();
    this.resetZoom();
    this.dialog.prevLightboxItem();
  }

  goToIndex(index: number) {
    this.resetZoom();
    this.dialog.setLightboxIndex(index);
  }

  closeLightbox() {
    this.resetZoom();
    this.dialog.closeLightbox();
  }
}
