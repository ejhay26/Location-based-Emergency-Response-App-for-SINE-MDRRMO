import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TourService } from '../../../core/services/tour';

interface Rect { top: number; left: number; width: number; height: number; }

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './tour-overlay.component.scss',
  template: `
<ng-container *ngIf="tour.isActive() && !tour.modalOpen()">

  <!-- Single full-screen backdrop — pointer-events NONE so the spotlight
       hole (the highlighted element beneath) stays tappable.
       Only the four dim panels block touches on the dark areas. -->
  <div class="tour-dim-top"    [style.height.px]="hole.top"></div>
  <div class="tour-dim-bottom" [style.top.px]="hole.top + hole.height"></div>
  <div class="tour-dim-left"
       [style.top.px]="hole.top"
       [style.height.px]="hole.height"
       [style.width.px]="hole.left > 0 ? hole.left : 0"></div>
  <div class="tour-dim-right"
       [style.top.px]="hole.top"
       [style.height.px]="hole.height"
       [style.left.px]="hole.left + hole.width"></div>

  <!-- Callout card -->
  <div class="tour-callout" [style]="calloutStyle">

    <div class="tour-step-counter">
      Step {{ tour.stepIndex() + 1 }} of {{ tour.totalSteps }}
    </div>

    <div class="tour-dots">
      <span *ngFor="let s of tour.steps; let i = index"
            class="tour-dot"
            [class.active]="i === tour.stepIndex()"></span>
    </div>

    <p class="tour-callout-main">{{ tour.currentStep.callout }}</p>
    <p class="tour-callout-sub" *ngIf="tour.currentStep.subtext">
      {{ tour.currentStep.subtext }}
    </p>

    <div class="tour-actions">
      <button class="tour-btn-skip" (click)="tour.cancel()">
        <i class="fa-solid fa-xmark"></i> Exit tutorial
      </button>
      <button *ngIf="!tour.currentStep.waitForInteraction && !tour.isLastStep"
              class="tour-btn-next" (click)="tour.next()">
        Next <i class="fa-solid fa-arrow-right"></i>
      </button>
      <button *ngIf="tour.isLastStep"
              class="tour-btn-finish" (click)="tour.finish()">
        <i class="fa-solid fa-check"></i> Finish
      </button>
    </div>

    <div *ngIf="tour.currentStep.waitForInteraction && tour.currentStep.interactionHint"
         class="tour-tap-hint">
      <i class="fa-solid fa-hand-pointer"></i>
      {{ tour.currentStep.interactionHint }}
    </div>

  </div>

</ng-container>
  `
})
export class TourOverlayComponent implements OnInit, OnDestroy {

  hole: Rect = { top: 0, left: 0, width: 0, height: 0 };
  calloutStyle = '';
  private pollInterval?: any;

  constructor(public tour: TourService, private cdr: ChangeDetectorRef) {
    effect(() => {
      const id = this.tour.targetId();
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

  private onResize = () => { if (this.tour.isActive()) this.measure(this.tour.targetId()); };

  measure(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const PAD = 10;
    const r = el.getBoundingClientRect();
    this.hole = {
      top:    r.top    - PAD,
      left:   r.left   - PAD,
      width:  r.width  + PAD * 2,
      height: r.height + PAD * 2,
    };
    this.positionCallout();
    this.cdr.detectChanges();
  }

  private positionCallout() {
    const CARD_H = 230;
    const CARD_W = 340;
    const VH = window.innerHeight;
    const VW = window.innerWidth;
    const PAD = 16;

    const spaceBelow = VH - (this.hole.top + this.hole.height);
    const spaceAbove = this.hole.top;
    let top: number;
    if (spaceBelow >= CARD_H + PAD * 2)      top = this.hole.top + this.hole.height + PAD;
    else if (spaceAbove >= CARD_H + PAD * 2) top = this.hole.top - CARD_H - PAD;
    else                                      top = Math.max(PAD, (VH - CARD_H) / 2);

    const cardW = Math.min(CARD_W, VW - 32);
    let left = this.hole.left + this.hole.width / 2 - cardW / 2;
    left = Math.max(PAD, Math.min(left, VW - cardW - PAD));
    this.calloutStyle = `top:${top}px;left:${left}px;`;
  }

  onBackdropClick() { /* intentionally empty — prevents accidental dismissal */ }
}
