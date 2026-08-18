import { createAnimation, Animation } from '@ionic/core';

/**
 * Post-Stage-5 follow-up — replaces Ionic's default 'md'-mode page
 * transition (a subtle fade) with a Motion-consistent bouncy "slide in on
 * top" transition: the entering page slides up from the bottom edge and
 * settles over the leaving page — which stays in place, dimming slightly
 * for depth rather than moving, since it's being covered, not replaced —
 * using a smooth decelerate easing curve (no overshoot: on a page-sized
 * element, an overshoot briefly pushes it past its resting position, which
 * for a moment exposes empty space at the trailing edge, since there's
 * nothing rendered behind it to mask that gap the way there is for a small
 * button or card). The bounce used elsewhere in this app's animations
 * (press feedback, card reveals) is deliberately NOT used here for that
 * reason — it's reserved for small components where overshoot has
 * surrounding content to land against.
 *
 * Reversed for back navigation: the foreground (leaving) page slides back
 * down off-stage, revealing the static page underneath, which needed no
 * transform of its own since it never moved to begin with.
 *
 * Registered app-wide via `provideIonicAngular({ navAnimation: ... })` in
 * main.ts, so it governs every root-level `<ion-router-outlet>` transition
 * (welcome → login → tabs/home, tabs/home → report, and back) rather than
 * needing to be wired into each page pair individually.
 *
 * Kept as Ionic's own Animation API (not Motion) deliberately — this is the
 * one transition surface Ionic already fully owns the lifecycle for
 * (ion-page-invisible timing, back-navigation DOM caching via
 * IonicRouteStrategy, the hardware back button, iOS edge-swipe progress).
 * Re-implementing that with manual DOM cloning, the way the custom tabs
 * router-outlet's push transition does, would mean rebuilding all of that
 * bookkeeping by hand for no real benefit.
 */
export function bouncyPageTransition(_baseEl: HTMLElement, opts: any): Animation {
  const enteringEl: HTMLElement | undefined = opts?.enteringEl;
  const leavingEl: HTMLElement | undefined = opts?.leavingEl;
  const isBack = opts?.direction === 'back';
  const SMOOTH_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  const rootAnimation = createAnimation()
    .duration(420)
    .easing(SMOOTH_EASING);

  if (enteringEl) {
    const enteringAnimation = createAnimation()
      .addElement(enteringEl)
      // Ionic marks not-yet-shown pages 'ion-page-invisible'; its own
      // built-in transitions remove that class as part of the animation
      // and ours has to do the same, or the entering page stays hidden
      // once this finishes.
      .beforeRemoveClass('ion-page-invisible')
      .beforeStyles({ 'z-index': isBack ? '0' : '10' })
      .afterClearStyles(['transform', 'z-index']);

    if (!isBack) {
      // Forward: the new page genuinely slides up from off-screen and lands on top.
      enteringAnimation.fromTo('transform', 'translateY(100%)', 'translateY(0%)');
    }
    // Back: the revealed page was never moved, so there's nothing to
    // animate on it — it just needs the class/z-index handling above.
    rootAnimation.addAnimation(enteringAnimation);
  }

  if (leavingEl) {
    const leavingAnimation = createAnimation()
      .addElement(leavingEl)
      .beforeStyles({ 'z-index': isBack ? '10' : '0' })
      // Explicit cleanup rather than trusting the final keyframe value to
      // "look right and leave it" — a stray non-'none' transform or filter
      // left behind creates a new stacking context on a page that's still
      // in the DOM (Ionic's RouteReuseStrategy caches recent pages for
      // back-nav), which is exactly the class of bug the tabs push
      // transition's own cleanup comment already flagged elsewhere in this
      // app: it can silently trap that page's own elevated z-index content
      // beneath something it shouldn't be beneath, the next time it's shown.
      .afterClearStyles(['transform', 'filter', 'z-index']);

    if (isBack) {
      // Back: the foreground (leaving) page slides back down off-stage.
      leavingAnimation.fromTo('transform', 'translateY(0%)', 'translateY(100%)');
    } else {
      // Forward: the old page stays put underneath and just dims slightly
      // for depth, since it's being covered rather than actually leaving.
      leavingAnimation.fromTo('filter', 'brightness(1)', 'brightness(0.85)');
    }
    rootAnimation.addAnimation(leavingAnimation);
  }

  return rootAnimation;
}
