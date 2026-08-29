import {
  Component, OnInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TourService } from '../../../core/services/tour';
import { AppIconComponent } from '../app-icon/app-icon.component';
import { Hole, TourGeometryUtil } from './tour-geometry.util';
import { TourSpringAnimator } from './tour-animation.util';
import { TourScrollUtil } from './tour-scroll.util';

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  styleUrl: './tour-overlay.component.scss',
  template: `
<ng-container *ngIf="tour.isActive() && !tour.modalOpen() && holeReady">

  <!-- Dim + blur backdrop with a TRUE cutout matching the target's real shape -->
  <div class="tour-dim" [style]="dimClipStyle"></div>

  <!-- Precise spotlight ring SVG -->
  <svg class="tour-ring-svg" [attr.viewBox]="'0 0 ' + vw + ' ' + vh">
    <path [attr.d]="holePath" class="tour-ring"></path>
  </svg>

  <!-- Click-anywhere-to-continue catcher for informational steps -->
  <div *ngIf="!tour.currentStep.waitForInteraction"
       class="tour-catcher" (click)="tour.next()"></div>

  <!-- Exit tutorial button -->
  <button class="tour-exit-btn" (click)="onExitClick($event)" aria-label="Exit tutorial" style="display:inline-flex;align-items:center;gap:6px;">
    <app-icon name="close" [size]="14" color="#ffffff"></app-icon> <span>Exit</span>
  </button>

  <!-- Floating Callout Card Styled with Native App Theme -->
  <div class="tour-text" [style]="textStyle">
    <div class="tour-step-badge">
      <span class="tour-step-dot"></span>
      <span>STEP {{ tour.stepIndex() + 1 }} OF {{ tour.totalSteps }}</span>
    </div>
    <h4 class="tour-callout-main">{{ activeCalloutInfo.callout }}</h4>
    <p class="tour-callout-sub" *ngIf="activeCalloutInfo.subtext">{{ activeCalloutInfo.subtext }}</p>
    <div class="tour-tap-hint">
      <app-icon [name]="tour.currentStep.waitForInteraction ? 'crosshairs' : 'chevron-right'" [size]="14" color="var(--ion-color-danger)"></app-icon>
      <span>{{ tour.currentStep.waitForInteraction ? (activeCalloutInfo.interactionHint || 'Click the highlighted button') : 'Tap anywhere to continue' }}</span>
    </div>
  </div>

</ng-container>
  `
})
export class TourOverlayComponent implements OnInit, OnDestroy {

  // ── View state ──
  hole: Hole = { top: 0, left: 0, width: 0, height: 0, isCircle: false, radius: 0 };
  holePath = '';
  dimClipStyle = '';
  textStyle = '';
  vw = window.innerWidth;
  vh = window.innerHeight;
  holeReady = false;

  // ── Adaptive callout (mobile vs desktop text) ──
  get activeCalloutInfo() {
    if (!this.tour.currentStep) return { callout: '', subtext: '', interactionHint: '' };
    return TourGeometryUtil.getAdaptiveCallout(this.tour.currentStep);
  }

  // ── Internal ──
  private currentTargetId = '';
  private missingSince: number | null = null;
  private readonly MISSING_TIMEOUT_MS = 6000;
  private pollInterval?: any;
  private tourSub?: Subscription;
  private readonly spring = new TourSpringAnimator();

  constructor(public tour: TourService, private cdr: ChangeDetectorRef) {}

  // ═══════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  ngOnInit() {
    this.tourSub = this.tour.stepChange$.subscribe(({ id, active }) => {
      if (!active || !id) {
        this.spring.cancel();
        this.holeReady = false;
        this.currentTargetId = '';
        this.missingSince = null;
        this.cdr.markForCheck();
        return;
      }

      this.missingSince = null;
      this.currentTargetId = id;
      requestAnimationFrame(() => this.transitionToTarget(id));
      this.cdr.markForCheck();
    });

    // Drift correction: re-measure the target every 300ms
    this.pollInterval = setInterval(() => {
      if (!this.tour.isActive() || !this.currentTargetId || this.spring.isMorphing || !this.holeReady) return;
      this.quietTrack(this.currentTargetId);
    }, 300);

    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    this.tourSub?.unsubscribe();
    clearInterval(this.pollInterval);
    this.spring.cancel();
    window.removeEventListener('resize', this.onResize);
  }

  // ═══════════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════

  onExitClick(ev: MouseEvent) {
    ev.stopPropagation();
    this.tour.cancel();
  }

  private onResize = () => {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    if (this.currentTargetId && this.holeReady) {
      this.quietTrack(this.currentTargetId);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  //  TARGET TRANSITION
  // ═══════════════════════════════════════════════════════════════

  private async transitionToTarget(id: string): Promise<void> {
    const el = await TourScrollUtil.waitForElement(id);
    if (!el) {
      this.handleMissing();
      return;
    }

    this.missingSince = null;

    // Scroll into view if needed
    if (!TourScrollUtil.isInView(el)) {
      await TourScrollUtil.scrollIntoView(el);
    }

    this.executeMorph(el);
  }

  private executeMorph(el: HTMLElement): void {
    const targetHole = TourGeometryUtil.computeHole(el);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;

    if (!this.holeReady) {
      // First step — snap directly, no animation
      this.hole = { ...targetHole };
      this.renderCurrentHole();
      this.holeReady = true;
      this.positionText(targetHole);
      this.cdr.detectChanges();

      // Re-measure text height after first paint
      requestAnimationFrame(() => {
        const textNode = document.querySelector('.tour-text') as HTMLElement | null;
        if (textNode) {
          this.positionText(targetHole, textNode.offsetHeight);
          this.cdr.detectChanges();
        }
      });
      return;
    }

    // Subsequent steps — spring animate
    this.positionText(targetHole);
    this.spring.animateTo(
      this.hole,
      el,
      (interpolated) => {
        this.hole = interpolated;
        this.renderCurrentHole();
        this.cdr.detectChanges();
      },
      (finalHole) => {
        this.hole = { ...finalHole };
        this.renderCurrentHole();

        const textNode = document.querySelector('.tour-text') as HTMLElement | null;
        if (textNode) {
          this.positionText(finalHole, textNode.offsetHeight);
        }
        this.cdr.detectChanges();
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  DRIFT CORRECTION & RENDERING
  // ═══════════════════════════════════════════════════════════════

  private quietTrack(id: string): void {
    const el = TourGeometryUtil.resolveElement(id);
    if (!el) return;

    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const fresh = TourGeometryUtil.computeHole(el);
    const dTop = Math.abs(fresh.top - this.hole.top);
    const dLeft = Math.abs(fresh.left - this.hole.left);

    if (dTop > 1.5 || dLeft > 1.5) {
      this.hole.top = fresh.top;
      this.hole.left = fresh.left;
      this.hole.width = fresh.width;
      this.hole.height = fresh.height;
      this.renderCurrentHole();
      this.positionText();
      this.cdr.detectChanges();
    }
  }

  private renderCurrentHole(): void {
    this.holePath = TourGeometryUtil.buildHoleShapePath(this.hole);
    this.dimClipStyle = TourGeometryUtil.buildDimClipPath(this.holePath, this.vw, this.vh);
  }

  private positionText(target?: Hole, actualHeight?: number) {
    const holeToUse = target || this.hole;
    this.textStyle = TourGeometryUtil.calculateCalloutPlacement(holeToUse, this.vw, this.vh, actualHeight);
  }

  // ═══════════════════════════════════════════════════════════════
  //  MISSING ELEMENT HANDLING
  // ═══════════════════════════════════════════════════════════════

  private handleMissing() {
    if (this.missingSince === null) {
      this.missingSince = Date.now();
    } else if (Date.now() - this.missingSince > this.MISSING_TIMEOUT_MS) {
      this.missingSince = null;
      console.warn(`[Tour] Target "${this.tour.targetId()}" not found for ${this.MISSING_TIMEOUT_MS}ms — auto-skipping.`);
      this.tour.skipMissingStep();
      return;
    }
    this.cdr.detectChanges();
  }
}
