import { createAnimation, Animation } from '@ionic/core';

/**
 * Custom enter/leave animation for the Report modal (Home → Report, kept
 * as a genuine ion-modal rather than a routed page — see
 * home.page.ts/openReport for why: it keeps HomePage's component instance
 * alive underneath instead of destroying/recreating it, which is what
 * actually fixes the announcement-reload/entrance-replay issue a cached
 * broadcast list alone couldn't fully solve).
 *
 * Deliberately NOT Ionic's default modal presentation (card-with-handle on
 * iOS, or a plain fade on md) — this animates the modal's own wrapper
 * sliding up from the bottom edge to fully cover the screen, matching the
 * same "slides in on top" language as bouncyPageTransition used for actual
 * route changes elsewhere in the app, so Report still feels like the same
 * kind of transition as any other page open, just without tearing down
 * Home to do it.
 *
 * No overshoot here, same reasoning as the page-level route transitions:
 * this is a full-screen element (the .report-modal CSS class in
 * global.scss sets --width/--height to 100%), so a spring/bounce would
 * briefly expose blank space past the edge with nothing behind it to mask
 * the gap. Reserved for buttons/cards/small components instead.
 *
 * ion-modal's internals are Shadow DOM, so the actual animated element has
 * to be found via baseEl.shadowRoot rather than a plain child selector.
 *
 * BUG FIX (opacity): Ionic's own base stylesheet sets `.modal-wrapper`'s
 * default opacity to 0.01 — it relies entirely on whatever enter animation
 * runs to explicitly tween it back to 1. This file originally only tweened
 * `transform`, so the wrapper correctly slid into position but stayed at
 * opacity 0.01 permanently: fully present, correctly positioned, and still
 * receiving taps/clicks, but visually invisible. That's why the modal
 * looked like "no page at all" while form validation (from taps landing on
 * the real, invisible controls underneath) still fired. Both directions
 * now explicitly own the opacity tween, mirroring transform.
 */
const IOS_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

export function reportModalEnter(baseEl: HTMLElement): Animation {
  const wrapper = baseEl.shadowRoot?.querySelector('.modal-wrapper') as HTMLElement | null;

  const root = createAnimation().addElement(baseEl).duration(320).easing(IOS_EASING);
  if (wrapper) {
    root.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .beforeStyles({ 'will-change': 'transform, opacity' })
        .fromTo('transform', 'translate3d(100%, 0, 0)', 'translate3d(0%, 0, 0)')
        .fromTo('opacity', 0.01, 1)
        .afterClearStyles(['will-change'])
    );
  }
  return root;
}

export function reportModalLeave(baseEl: HTMLElement): Animation {
  const wrapper = baseEl.shadowRoot?.querySelector('.modal-wrapper') as HTMLElement | null;

  const root = createAnimation().addElement(baseEl).duration(260).easing('cubic-bezier(0.4, 0, 1, 1)');
  if (wrapper) {
    root.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .beforeStyles({ 'will-change': 'transform, opacity' })
        .fromTo('transform', 'translate3d(0%, 0, 0)', 'translate3d(100%, 0, 0)')
        .fromTo('opacity', 1, 0.01)
        .afterClearStyles(['will-change'])
    );
  }
  return root;
}
