import { Directive, ElementRef, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { animate } from 'motion';
import { UserSettingsService } from '../../core/services/user-settings';

/**
 * Post-Stage-5 follow-up — a one-shot fade + rise entrance for items that
 * appear via *ngFor (announcements on Home and History), staggered by
 * index so a freshly-loaded list reads as cascading in rather than
 * popping onto the screen all at once. Usage:
 *
 *   <div *ngFor="let x of items; let i = index" [appAnnouncementEnter]="i">
 *
 * Plays once per element instance, on creation only (ngOnInit) — this is
 * deliberately NOT reactive to further input changes the way
 * RevealAnimateDirective is, since these items don't have an open/closed
 * state to animate between, only an initial appearance.
 */
@Directive({
  selector: '[appAnnouncementEnter]',
  standalone: true,
})
export class ListEnterDirective implements OnInit {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly settings = inject(UserSettingsService);

  /** Position in the list — used only to stagger the start time, capped so a long list doesn't leave the last items waiting seconds to appear. */
  @Input('appAnnouncementEnter') index = 0;

  ngOnInit(): void {
    if (!this.settings.shouldAnimate()) return;
    const node = this.el.nativeElement;
    const delay = Math.min(this.index, 6) * 0.06;

    node.style.opacity = '0';
    node.style.transform = 'translateY(14px)';

    requestAnimationFrame(() => {
      animate(
        node,
        { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0px)'] },
        { duration: 0.36, delay, ease: [0.34, 1.4, 0.64, 1] }
      ).finished
        .then(() => { node.style.opacity = ''; node.style.transform = ''; })
        .catch(() => { node.style.opacity = ''; node.style.transform = ''; });
    });
  }
}
