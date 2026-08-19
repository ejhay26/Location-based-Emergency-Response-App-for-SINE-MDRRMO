import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from '../../../core/services/tour';

interface Hole {
  top: number; left: number; width: number; height: number;
  isCircle: boolean; radius: number;
}

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule],
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
  <button class="tour-exit-btn" (click)="onExitClick($event)" aria-label="Exit tutorial">
    <i class="fa-solid fa-xmark"></i> Exit
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
    <p class="tour-tap-hint">
      <i class="fa-solid" [class.fa-hand-pointer]="tour.currentStep.waitForInteraction" [class.fa-hand]="!tour.currentStep.waitForInteraction"></i>
      {{ tour.currentStep.waitForInteraction ? (tour.currentStep.interactionHint || 'Tap the highlighted item') : 'Tap anywhere to continue' }}
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

  /**
   * Gate the ENTIRE overlay on having successfully measured a real target
   * at least once for the current step. Without this, a target that
   * briefly can't be found (id typo, wrong page, mid-navigation) would
   * render an overlay with no real hole — this way a measurement miss
   * simply renders nothing at all, leaving the app fully usable instead
   * of silently blocking it. This is the core "never gets stuck" guarantee.
   */
  holeReady = false;
  private pollInterval?: any;

  /** Only scroll the target into view ONCE per step (on first successful
   * measurement), not on every 400ms poll — otherwise it would fight any
   * scrolling the user does themselves mid-step. */
  private scrolledForId = '';

  /**
   * If a target genuinely can't be found for several seconds straight (bad
   * id, page not settled, a component that got renamed/removed later), the
   * step would otherwise sit invisible forever with isActive() still true —
   * the app stays usable, but the tour itself is effectively dead with no
   * obvious way out. Auto-skipping after a timeout turns that failure mode
   * into "the tour continues, minus one broken step" instead of "the tour
   * silently disappears". See TourService.skipMissingStep().
   */
  private missingSince: number | null = null;
  private readonly MISSING_TIMEOUT_MS = 3000;

  constructor(public tour: TourService, private cdr: ChangeDetectorRef) {
    effect(() => {
      const id = this.tour.targetId();
      // Reset immediately so a stale hole from the PREVIOUS step (and its
      // mount animations) never renders while we wait on the new target,
      // and so the missing-target timer and scroll-once guard both start
      // fresh for the new step.
      this.holeReady = false;
      this.missingSince = null;
      this.scrolledForId = '';
      if (id) setTimeout(() => this.measure(id), 350);
    });
  }

  ngOnInit() {
    this.pollInterval = setInterval(() => {
      if (!this.tour.isActive() || !this.tour.targetId()) return;
      this.measure(this.tour.targetId());
    }, 400);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    if (this.tour.isActive()) this.measure(this.tour.targetId());
  };

  onExitClick(ev: MouseEvent) {
    ev.stopPropagation();
    this.tour.cancel();
  }

  measure(id: string) {
    const el = document.getElementById(id);
    if (!el) { this.handleMissing(); return; }

    if (this.scrolledForId !== id) {
      this.scrolledForId = id;
      this.scrollTargetIntoView(el);
    }

    const r = el.getBoundingClientRect();
    // A found-but-not-actually-laid-out element (e.g. inside a collapsed
    // *ngIf branch, or a page still mid-transition with zero size) reports
    // a zero-size rect too — guard against that the same way as a missing
    // element, rather than briefly flashing a broken hole.
    if (r.width <= 0 || r.height <= 0) { this.handleMissing(); return; }

    this.missingSince = null;

    const PAD = 12;
    const cs = getComputedStyle(el);
    const brPx = parseFloat(cs.borderTopLeftRadius) || 0;
    const minDim = Math.min(r.width, r.height);
    // Treat as a circle once the corner radius covers roughly the shorter
    // side's half — i.e. an actual circular/pill-round element — otherwise
    // treat it as a rounded rectangle using its own real radius. Fully
    // dynamic: read from the live element's own styles every time, nothing
    // hardcoded per target id, so any current or future tour target is
    // handled automatically.
    const isCircle = brPx >= minDim * 0.4;

    this.hole = {
      top:    r.top    - PAD,
      left:   r.left   - PAD,
      width:  r.width  + PAD * 2,
      height: r.height + PAD * 2,
      isCircle,
      radius: isCircle ? 0 : brPx + PAD,
    };
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.holePath = this.buildHoleShapePath();
    const clip = `path(evenodd, "M0,0H${this.vw}V${this.vh}H0Z${this.holePath}")`;
    this.dimClipStyle = `clip-path:${clip};-webkit-clip-path:${clip};`;
    this.holeReady = true;
    this.positionText(); // rough pass, using the fallback estimate below
    this.cdr.detectChanges();

    // Second pass: the text block has now actually rendered, so reposition
    // using its REAL height instead of the fixed estimate. A step with a
    // long callout/subtext can run taller than the estimate, which would
    // otherwise push the (actually taller) text off the bottom of the
    // screen — this is the "out of screen bound" case.
    const textNode = document.querySelector('.tour-text') as HTMLElement | null;
    if (textNode) {
      this.positionText(textNode.offsetHeight);
      this.cdr.detectChanges();
    }
  }

  private handleMissing() {
    this.holeReady = false;
    if (this.missingSince === null) {
      this.missingSince = Date.now();
    } else if (Date.now() - this.missingSince > this.MISSING_TIMEOUT_MS) {
      this.missingSince = null;
      // eslint-disable-next-line no-console
      console.warn(`[Tour] Target "${this.tour.targetId()}" not found for ${this.MISSING_TIMEOUT_MS}ms — auto-skipping.`);
      this.tour.skipMissingStep();
      return;
    }
    this.cdr.detectChanges();
  }

  /**
   * Scrolls the target's nearest real scroll container so the target sits
   * in the UPPER third of the viewport rather than dead-center. Centering
   * looks fine for the target itself, but several steps have important
   * related controls sitting just BELOW the target (e.g. "Use My Location"
   * right under the map, the Save button under the medical form) that a
   * plain center-scroll can still leave cut off at the bottom edge. Biasing
   * upward leaves more room below to reveal that following content.
   */
  private scrollTargetIntoView(el: HTMLElement) {
    const scrollParent = this.findScrollParent(el);
    if (!scrollParent) return;
    const parentRect = scrollParent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const desiredTop = parentRect.top + parentRect.height * 0.28;
    const delta = elRect.top - desiredTop;
    // Only bother scrolling if it's meaningfully out of place — avoids a
    // pointless 1px smooth-scroll jitter on every step.
    if (Math.abs(delta) > 24) {
      scrollParent.scrollBy({ top: delta, behavior: 'smooth' });
    }
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
    // Ionic's real scroll container lives inside <ion-content>'s shadow DOM
    // (exposed as the "scroll" part), not as a plain overflow ancestor in
    // the light DOM — fall back to it directly if nothing else qualified.
    const ionContent = el.closest('ion-content') as any;
    return ionContent?.shadowRoot?.querySelector('[part="scroll"]') ?? null;
  }

  /**
   * Builds ONE subpath for the hole's own shape (circle or rounded rect) —
   * reused both as the ring's stroke path and, combined with a full-
   * viewport outer rect via evenodd, as the dim layer's clip-path.
   */
  private buildHoleShapePath(): string {
    const { top, left, width, height, isCircle, radius } = this.hole;
    if (isCircle) {
      const cx = left + width / 2;
      const cy = top + height / 2;
      const rad = Math.max(width, height) / 2;
      // A full circle needs two arcs — a single 360° arc command doesn't render.
      return `M${cx - rad},${cy}a${rad},${rad} 0 1,0 ${rad * 2},0a${rad},${rad} 0 1,0 ${-rad * 2},0Z`;
    }
    const rad = Math.max(0, Math.min(radius, width / 2, height / 2));
    const x = left, y = top, w = width, h = height;
    return rad > 0
      ? `M${x + rad},${y}H${x + w - rad}A${rad},${rad} 0 0 1 ${x + w},${y + rad}V${y + h - rad}A${rad},${rad} 0 0 1 ${x + w - rad},${y + h}H${x + rad}A${rad},${rad} 0 0 1 ${x},${y + h - rad}V${y + rad}A${rad},${rad} 0 0 1 ${x + rad},${y}Z`
      : `M${x},${y}H${x + w}V${y + h}H${x}Z`;
  }

  private positionText(actualHeight?: number) {
    const TEXT_H = actualHeight ?? 180; // estimate for the first pass only
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
