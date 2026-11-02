import { Directive, ElementRef, HostListener, Input, OnDestroy, inject } from '@angular/core';
import { animate } from 'motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { UserSettingsService } from '../../core/services/user-settings';

/**
 * Post-Stage-5 follow-up — an extra tap "impact" for the app's two most
 * safety-critical actions (SOS, Report Hazard), layered on top of the
 * existing `appPressFeedback` scale-bounce rather than replacing it:
 *
 *   <button appPressFeedback appImpactFeedback [impactColor]="'#eb445a'" (click)="...">
 *
 * On release it (a) fires a short Capacitor haptic tap on real devices —
 * a no-op on web/unsupported platforms, wrapped defensively since haptics
 * APIs are not guaranteed available everywhere — and (b) expands a brief
 * ring burst from the button's own center, similar in spirit to a material
 * ripple but reversed (grows and fades outward rather than filling in),
 * so the two buttons the app most needs a user to trust read as distinctly
 * more emphatic than an ordinary button press.
 */
@Directive({
  selector: '[appImpactFeedback]',
  standalone: true,
})
export class ImpactFeedbackDirective implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly settings = inject(UserSettingsService);

  /** Ring color; defaults to white, which reads fine on both the SOS red and Hazard amber gradients. */
  @Input() impactColor = 'rgba(255,255,255,0.85)';

  private activeRings: HTMLElement[] = [];

  @HostListener('pointerup')
  onImpact(): void {
    this.fireHaptic();
    if (!this.settings.shouldAnimate()) return;
    this.spawnRing();
  }

  private fireHaptic(): void {
    // Deliberately fire-and-forget with its own catch — a haptics failure
    // (unsupported platform, permissions, running in a plain browser tab)
    // must never block or throw into the button's actual click handler.
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => { /* no-op: haptics unavailable */ });
  }

  private spawnRing(): void {
    const host = this.el.nativeElement;
    // Buttons here are already position:relative (SOS) or get it implicitly
    // via their own layout; guard explicitly so the ring is always
    // positioned against this button, not some further-out ancestor.
    const computedPosition = getComputedStyle(host).position;
    if (computedPosition === 'static') host.style.position = 'relative';

    const ring = document.createElement('span');
    // Percentage-based sizing would render as an ellipse on non-square
    // buttons (the Hazard button is a wide rounded rect, not a circle) —
    // measure the actual box and size the ring as a true circle off the
    // shorter dimension instead.
    const rect = host.getBoundingClientRect();
    const diameter = Math.min(rect.width, rect.height) * 0.3;
    ring.style.position = 'absolute';
    ring.style.left = '50%';
    ring.style.top = '50%';
    ring.style.width = `${diameter}px`;
    ring.style.height = `${diameter}px`;
    ring.style.borderRadius = '50%';
    ring.style.border = `2px solid ${this.impactColor}`;
    ring.style.pointerEvents = 'none';
    ring.style.transform = 'translate(-50%, -50%) scale(1)';
    ring.style.opacity = '0.9';
    host.appendChild(ring);
    this.activeRings.push(ring);

    animate(
      ring,
      { transform: ['translate(-50%, -50%) scale(1)', 'translate(-50%, -50%) scale(2.6)'], opacity: [0.9, 0] },
      { duration: 0.5, ease: 'easeOut' }
    ).finished
      .then(() => this.removeRing(ring))
      .catch(() => this.removeRing(ring));
  }

  private removeRing(ring: HTMLElement): void {
    ring.remove();
    this.activeRings = this.activeRings.filter(r => r !== ring);
  }

  ngOnDestroy(): void {
    // Memory-safety: drop any rings still mid-animation on a detached node
    // rather than letting their .finished promises try to touch it later.
    this.activeRings.forEach(r => r.remove());
    this.activeRings = [];
  }
}
