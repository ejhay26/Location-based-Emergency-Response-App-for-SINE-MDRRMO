import { createAnimation, Animation } from '@ionic/core';

/**
 * Replaces the clone-based tab-switch push transition with a genuine Ionic
 * one, operating on the outlet's real `enteringEl`/`leavingEl` — no DOM
 * cloning needed, because a single `<ion-router-outlet>` (unlike the plain
 * Angular `<router-outlet>` previously used here) keeps the outgoing page
 * alive in its navigation stack during the transition instead of destroying
 * it synchronously. That's what made the two elements exist simultaneously
 * and genuinely animatable together, and it's also what eliminates the
 * synchronization race the clone-based version had (both elements are
 * already real and present the instant this function runs — there's no
 * "wait for the incoming page to be created" step to race against).
 *
 * `opts.direction` is 'forward' | 'back', set by whichever of
 * `NavController.navigateForward()` / `.navigateBack()` TabsPage.navigate()
 * called — that's what this depends on for left/right; a plain
 * `Router.navigate()` call wouldn't populate it correctly.
 */
export function tabPushTransition(_baseEl: HTMLElement, opts: any): Animation {
  const enteringEl: HTMLElement | undefined = opts?.enteringEl;
  const leavingEl: HTMLElement | undefined = opts?.leavingEl;
  const isBack = opts?.direction === 'back';
  // No overshoot here — a bouncy/spring curve on a full-page slide briefly
  // pushes the entering page past translateX(0%), which for a moment
  // exposes empty space past the OTHER edge (nothing rendered there to
  // cover it). Overshoot reads fine on small elements (buttons, cards)
  // where there's always surrounding content to mask it; it doesn't work
  // for a page-sized element with a hard edge. Standard Material
  // "decelerate" curve instead — smooth, confident, no overshoot.
  const SMOOTH_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  const rootAnimation = createAnimation()
    .duration(320)
    .easing(SMOOTH_EASING);

  if (enteringEl) {
    const fromX = isBack ? '-100%' : '100%';
    const enteringAnimation = createAnimation()
      .addElement(enteringEl)
      .beforeRemoveClass('ion-page-invisible')
      .afterClearStyles(['transform'])
      .fromTo('transform', `translateX(${fromX})`, 'translateX(0%)');
    rootAnimation.addAnimation(enteringAnimation);
  }

  if (leavingEl) {
    const toX = isBack ? '100%' : '-100%';
    const leavingAnimation = createAnimation()
      .addElement(leavingEl)
      .afterClearStyles(['transform'])
      .fromTo('transform', 'translateX(0%)', `translateX(${toX})`);
    rootAnimation.addAnimation(leavingAnimation);
  }

  return rootAnimation;
}
