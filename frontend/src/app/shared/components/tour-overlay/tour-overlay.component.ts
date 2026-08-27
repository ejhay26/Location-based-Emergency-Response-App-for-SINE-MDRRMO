import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from '../../../core/services/tour';
import { AppIconComponent } from '../app-icon/app-icon.component';

interface Hole {
  top: number; left: number; width: number; height: number;
  isCircle: boolean; radius: number;
}

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  styleUrl: './tour-overlay.component.scss',
  template: `
<ng-container *ngIf="tour.isActive() && !tour.modalOpen() && holeReady">

  <!-- Dim + blur backdrop with a TRUE cutout matching the target's real
       shape (circle for round buttons, rounded-rect otherwise — read live
       from the element's own computed border-radius every time, nothing
       hardcoded per id). The cutout is a genuine CSS clip-path (evenodd),
       not a visual-only mask, so the hole area has no hit-target either —
       clicks pass straight through it to the real element beneath. That's
       what keeps a waitForInteraction step's real button/tab/grid item
       tappable exactly as before, with zero extra click-routing logic. -->
  <div class="tour-dim" [style]="dimClipStyle"></div>

  <!-- Precise spotlight ring — traced from the SAME measured shape as the
       hole above (not a CSS outline). CSS outlines don't reliably clip to
       border-radius on every WebView, which is what produced a square/
       squircle halo behind circular buttons before; an SVG stroke along
       the real path has no such ambiguity. -->
  <svg class="tour-ring-svg" [attr.viewBox]="'0 0 ' + vw + ' ' + vh">
    <path [attr.d]="holePath" class="tour-ring"></path>
  </svg>

  <!-- Click-anywhere-to-continue catcher. Only rendered for steps that do
       NOT require a real interaction — tapping literally anywhere,
       including over the highlighted target itself, just advances the
       tour without ever reaching the real element underneath (so an
       informational step never accidentally fires the real button's own
       action). Steps that DO require a real interaction render no
       catcher at all, so the tap reaches the real element through the
       clip-path hole exactly as it always has. -->
  <div *ngIf="!tour.currentStep.waitForInteraction"
       class="tour-catcher" (click)="tour.next()"></div>

  <!-- Exit tutorial — always present, always on top, independent of the
       catcher or whichever step is active. Guaranteed way out no matter
       what else is happening. -->
  <button class="tour-exit-btn" (click)="onExitClick($event)" aria-label="Exit tutorial" style="display:inline-flex;align-items:center;gap:6px;">
    <app-icon name="close" [size]="14" color="#ffffff"></app-icon> <span>Exit</span>
  </button>

  <!-- Text-only callout — no card, no background box. Bold and large so
       it stays readable at a glance, including for seniors on a small
       phone screen. Layered text-shadow keeps it legible over any photo,
       color, or brightness behind it since there's no solid backing
       panel. -->
  <div class="tour-text" [style]="textStyle">
    <div class="tour-step-counter">Step {{ tour.stepIndex() + 1 }} of {{ tour.totalSteps }}</div>
    <p class="tour-callout-main">{{ tour.currentStep.callout }}</p>
    <p class="tour-callout-sub" *ngIf="tour.currentStep.subtext">{{ tour.currentStep.subtext }}</p>
    <p class="tour-tap-hint" style="display:flex;align-items:center;gap:6px;">
      <app-icon [name]="tour.currentStep.waitForInteraction ? 'crosshairs' : 'chevron-right'" [size]="14" color="#ffffff"></app-icon>
      <span>{{ tour.currentStep.waitForInteraction ? (tour.currentStep.interactionHint || 'Tap the highlighted item') : 'Tap anywhere to continue' }}</span>
    </p>
  </div>

</ng-container>
  `
})
export class TourOverlayComponent implements OnInit, OnDestroy {

  hole: Hole = { top: 0, left: 0, width: 0, height: 0, isCircle: false, radius: 0 };
  holePath = '';
  dimClipStyle = '';
  textStyle = '';
  vw = window.innerWidth;
  vh = window.innerHeight;

  holeReady = false;
  private pollInterval?: any;
  private animFrameId: number | null = null;
  private isMorphing = false;

  private currentTargetId = '';
  private scrollTimeoutId?: any;
  private missingSince: number | null = null;
  private readonly MISSING_TIMEOUT_MS = 6000;

  constructor(public tour: TourService, private cdr: ChangeDetectorRef) {
    effect(() => {
      const id = this.tour.targetId();
      if (!this.tour.isActive() || !id) {
        this.cancelSpring();
        this.holeReady = false;
        this.currentTargetId = '';
        this.missingSince = null;
        return;
      }

      this.missingSince = null;
      if (id !== this.currentTargetId) {
        this.currentTargetId = id;
        // Schedule next-tick transition so any page/DOM navigation settles
        requestAnimationFrame(() => this.transitionToTarget(id));
      }
    });
  }

  ngOnInit() {
    this.pollInterval = setInterval(() => {
      if (!this.tour.isActive() || !this.currentTargetId || this.isMorphing || !this.holeReady) return;
      this.quietTrack(this.currentTargetId);
    }, 300);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
    clearTimeout(this.scrollTimeoutId);
    this.cancelSpring();
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    if (this.tour.isActive() && this.currentTargetId) {
      this.quietTrack(this.currentTargetId);
    }
  };

  onExitClick(ev: MouseEvent) {
    ev.stopPropagation();
    this.tour.cancel();
  }

  private getTargetElement(id: string): HTMLElement | null {
    if (!id) return null;
    const cleanId = id.startsWith('#') ? id.slice(1) : id;
    return document.getElementById(cleanId) || (document.querySelector(id) as HTMLElement | null);
  }

  /**
   * Orchestrates the transition to a new step target:
   * 1. Finds element.
   * 2. Scrolls container if needed and WAITS for the scroll to settle.
   * 3. Seamlessly morphs the spotlight directly to the final resting target using live-frame tracking.
   */
  private transitionToTarget(id: string, retryCount = 0): void {
    const el = this.getTargetElement(id);
    if (!el) {
      if (retryCount < 25) {
        setTimeout(() => this.transitionToTarget(id, retryCount + 1), 80);
      } else {
        this.handleMissing();
      }
      return;
    }

    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      if (retryCount < 25) {
        setTimeout(() => this.transitionToTarget(id, retryCount + 1), 80);
      } else {
        this.handleMissing();
      }
      return;
    }

    this.missingSince = null;
    clearTimeout(this.scrollTimeoutId);

    const scrollParent = this.findScrollParent(el);
    let needsScroll = false;

    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const desiredTop = parentRect.top + parentRect.height * 0.28;
      const delta = elRect.top - desiredTop;

      if (Math.abs(delta) > 28) {
        needsScroll = true;
        scrollParent.scrollBy({ top: delta, behavior: 'smooth' });

        let settled = false;
        const onSettled = () => {
          if (settled) return;
          settled = true;
          scrollParent.removeEventListener('scrollend', onSettled);
          clearTimeout(this.scrollTimeoutId);
          this.executeMorph(el);
        };

        scrollParent.addEventListener('scrollend', onSettled, { once: true });
        // 260ms timeout fallback for platforms without native scrollend event
        this.scrollTimeoutId = setTimeout(onSettled, 260);
        return;
      }
    }

    // No scroll required — start morph immediately
    this.executeMorph(el);
  }

  private executeMorph(el: HTMLElement): void {
    const targetHole = this.computeHole(el);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;

    if (!this.holeReady) {
      // Step 1: Initial materialization of the tour
      this.hole = { ...targetHole };
      this.renderCurrentHole();
      this.holeReady = true;
      this.positionText();
      this.cdr.detectChanges();

      requestAnimationFrame(() => {
        const textNode = document.querySelector('.tour-text') as HTMLElement | null;
        if (textNode) {
          this.positionText(textNode.offsetHeight);
          this.cdr.detectChanges();
        }
      });
      return;
    }

    // Subsequent steps: Always fluid spring animation
    this.animateToElement(el);
  }

  /**
   * Fluid Spring Animation with LIVE tracking.
   * By querying getBoundingClientRect() on every tick, the spotlight dynamically
   * interpolates towards the element's actual position even if small residual
   * layout shifts or momentum scrolling are completing.
   */
  private animateToElement(el: HTMLElement): void {
    this.cancelSpring();
    this.isMorphing = true;

    const from = { ...this.hole };
    const startTime = performance.now();
    const durationMs = 450;
    const zeta = 0.76;
    const omega = 14.5;
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);

    const tick = (now: number) => {
      const elapsed = Math.max(0, (now - startTime) / 1000);
      let progress = 1;

      if (elapsed * 1000 < durationMs) {
        const decay = Math.exp(-zeta * omega * elapsed);
        const oscillation = Math.cos(omegaD * elapsed) + ((zeta * omega) / omegaD) * Math.sin(omegaD * elapsed);
        progress = 1 - decay * oscillation;
      }

      // Compute live target on every frame to eliminate any jumping or pre-scroll guessing
      const currentTarget = this.computeHole(el);

      this.hole.top    = from.top    + (currentTarget.top    - from.top)    * progress;
      this.hole.left   = from.left   + (currentTarget.left   - from.left)   * progress;
      this.hole.width  = from.width  + (currentTarget.width  - from.width)  * progress;
      this.hole.height = from.height + (currentTarget.height - from.height) * progress;
      this.hole.radius = from.radius + (currentTarget.radius - from.radius) * progress;
      this.hole.isCircle = progress > 0.5 ? currentTarget.isCircle : from.isCircle;

      this.renderCurrentHole();
      this.positionText();
      this.cdr.detectChanges();

      if (elapsed * 1000 < durationMs) {
        this.animFrameId = requestAnimationFrame(tick);
      } else {
        const finalTarget = this.computeHole(el);
        this.hole = { ...finalTarget };
        this.renderCurrentHole();
        this.isMorphing = false;
        this.animFrameId = null;

        const textNode = document.querySelector('.tour-text') as HTMLElement | null;
        if (textNode) {
          this.positionText(textNode.offsetHeight);
        }
        this.cdr.detectChanges();
      }
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  /**
   * Quiet position tracker: Gently follows element if user manually scrolls,
   * without interrupting or re-snapping.
   */
  private quietTrack(id: string): void {
    const el = this.getTargetElement(id);
    if (!el) return;

    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;

    const fresh = this.computeHole(el);
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

  private computeHole(el: HTMLElement): Hole {
    const r = el.getBoundingClientRect();
    const PAD = 12;
    const cs = getComputedStyle(el);
    const brPx = parseFloat(cs.borderTopLeftRadius) || 0;
    const minDim = Math.min(r.width, r.height);
    const inlineStyle = el.getAttribute('style') || '';
    const isCircle = inlineStyle.includes('border-radius:50%') ||
                     inlineStyle.includes('border-radius: 50%') ||
                     brPx >= minDim * 0.4;

    return {
      top:    r.top    - PAD,
      left:   r.left   - PAD,
      width:  r.width  + PAD * 2,
      height: r.height + PAD * 2,
      isCircle,
      radius: isCircle ? 0 : brPx + PAD,
    };
  }

  private renderCurrentHole(): void {
    this.holePath = this.buildHoleShapePath();
    const clip = `path(evenodd, "M0,0H${this.vw}V${this.vh}H0Z${this.holePath}")`;
    this.dimClipStyle = `clip-path:${clip};-webkit-clip-path:${clip};`;
  }

  private cancelSpring(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isMorphing = false;
  }

  private handleMissing() {
    this.holeReady = false;
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

  private findScrollParent(el: HTMLElement): Element | null {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentElement;
    }
    const ionContent = el.closest('ion-content') as any;
    return ionContent?.shadowRoot?.querySelector('[part="scroll"]') ?? null;
  }

  private buildHoleShapePath(): string {
    const { top, left, width, height, isCircle, radius } = this.hole;
    if (isCircle) {
      const cx = left + width / 2;
      const cy = top + height / 2;
      const rad = Math.max(width, height) / 2;
      return `M${cx - rad},${cy}a${rad},${rad} 0 1,0 ${rad * 2},0a${rad},${rad} 0 1,0 ${-rad * 2},0Z`;
    }
    const rad = Math.max(0, Math.min(radius, width / 2, height / 2));
    const x = left, y = top, w = width, h = height;
    return rad > 0
      ? `M${x + rad},${y}H${x + w - rad}A${rad},${rad} 0 0 1 ${x + w},${y + rad}V${y + h - rad}A${rad},${rad} 0 0 1 ${x + w - rad},${y + h}H${x + rad}A${rad},${rad} 0 0 1 ${x},${y + h - rad}V${y + rad}A${rad},${rad} 0 0 1 ${x + rad},${y}Z`
      : `M${x},${y}H${x + w}V${y + h}H${x}Z`;
  }

  private positionText(actualHeight?: number) {
    const TEXT_H = actualHeight ?? 180;
    const TEXT_W = 360;
    const VH = window.innerHeight;
    const VW = window.innerWidth;
    const PAD = 20;

    const spaceBelow = VH - (this.hole.top + this.hole.height);
    const spaceAbove = this.hole.top;
    let top: number;
    if (spaceBelow >= TEXT_H + PAD * 2)      top = this.hole.top + this.hole.height + PAD;
    else if (spaceAbove >= TEXT_H + PAD * 2) top = this.hole.top - TEXT_H - PAD;
    else                                      top = Math.max(PAD, Math.min((VH - TEXT_H) / 2, VH - TEXT_H - PAD));

    const textW = Math.min(TEXT_W, VW - 32);
    let left = this.hole.left + this.hole.width / 2 - textW / 2;
    left = Math.max(PAD, Math.min(left, VW - textW - PAD));
    this.textStyle = `top:${top}px;left:${left}px;width:${textW}px;`;
  }
}
