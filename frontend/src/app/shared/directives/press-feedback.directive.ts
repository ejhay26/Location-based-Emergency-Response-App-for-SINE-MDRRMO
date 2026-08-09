import { Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';
import { animate, type AnimationPlaybackControls } from 'motion';
import { UserSettingsService } from '../../core/services/user-settings';

/**
 * Stage 5 — a brief scale-down/scale-up "press" bounce on pointerdown /
 * pointerup, so tapping the app's most safety-critical actions (SOS,
 * Hazard, Report submit) feels tactile rather than static. Usage:
 *
 *   <button appPressFeedback (click)="...">SOS</button>
 */
@Directive({
  selector: '[appPressFeedback]',
  standalone: true,
})
export class PressFeedbackDirective implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly settings = inject(UserSettingsService);

  private controls?: AnimationPlaybackControls;

  @HostListener('pointerdown')
  onPress(): void {
    if (!this.settings.shouldAnimate()) return;
    // Stop any still-running release tween before starting a new press —
    // otherwise a fast double-tap could leave two competing animations
    // fighting over the same transform.
    this.controls?.stop();
    this.controls = animate(this.el.nativeElement, { scale: 0.94 }, { duration: 0.1, ease: 'easeOut' });
  }

  @HostListener('pointerup')
  @HostListener('pointerleave')
  @HostListener('pointercancel')
  onRelease(): void {
    if (!this.settings.shouldAnimate()) return;
    this.controls?.stop();
    const el = this.el.nativeElement;
    this.controls = animate(el, { scale: 1 }, { duration: 0.15, ease: 'easeOut' });
    // Clear the inline transform once settled instead of leaving
    // 'scale(1)' sitting on the element — a non-'none' transform forces a
    // new stacking context, which would trap this button's own children's
    // z-index (and, on elements that are themselves .tour-highlight
    // targets like the SOS/Hazard buttons, is one extra reason to keep
    // this element's stacking context exactly as it was before it was
    // ever touched).
    this.controls.finished
      .then(() => { el.style.transform = ''; })
      .catch(() => { el.style.transform = ''; });
  }

  ngOnDestroy(): void {
    // Memory-safety: stop a running tween so it can't keep writing styles
    // to a detached node after Angular removes this element.
    this.controls?.stop();
  }
}
