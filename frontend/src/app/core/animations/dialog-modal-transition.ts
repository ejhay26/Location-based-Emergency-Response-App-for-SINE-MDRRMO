import { Animation, createAnimation } from '@ionic/core';

const ENTER_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const LEAVE_EASING = 'cubic-bezier(0.4, 0, 1, 1)';

function prefersReducedMotion(): boolean {
  if (typeof document !== 'undefined') {
    if (
      document.documentElement.classList.contains('reduce-animations') ||
      document.documentElement.classList.contains('reduce-motion') ||
      document.body?.classList.contains('reduce-animations') ||
      document.body?.classList.contains('reduce-motion')
    ) {
      return true;
    }
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

export function dialogModalEnter(baseEl: HTMLElement): Animation {
  const backdrop = baseEl.shadowRoot?.querySelector('ion-backdrop') as HTMLElement | null;
  const wrapper = baseEl.shadowRoot?.querySelector('.modal-wrapper') as HTMLElement | null;
  const duration = prefersReducedMotion() ? 0 : 260;

  const root = createAnimation().addElement(baseEl).duration(duration);

  if (backdrop) {
    root.addAnimation(
      createAnimation()
        .addElement(backdrop)
        .fromTo('opacity', '0.01', '1')
    );
  }

  if (wrapper) {
    root.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .easing(ENTER_EASING)
        .beforeStyles({ 'will-change': 'transform, opacity' })
        .fromTo('opacity', '0.01', '1')
        .fromTo('transform', 'scale(0.93) translateY(8px)', 'scale(1) translateY(0)')
        .afterClearStyles(['will-change'])
    );
  }

  return root;
}

export function dialogModalLeave(baseEl: HTMLElement): Animation {
  const backdrop = baseEl.shadowRoot?.querySelector('ion-backdrop') as HTMLElement | null;
  const wrapper = baseEl.shadowRoot?.querySelector('.modal-wrapper') as HTMLElement | null;
  const duration = prefersReducedMotion() ? 0 : 170;

  const root = createAnimation().addElement(baseEl).duration(duration);

  if (backdrop) {
    root.addAnimation(
      createAnimation()
        .addElement(backdrop)
        .fromTo('opacity', '1', '0')
    );
  }

  if (wrapper) {
    root.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .easing(LEAVE_EASING)
        .beforeStyles({ 'will-change': 'transform, opacity' })
        .fromTo('opacity', '1', '0')
        .fromTo('transform', 'scale(1) translateY(0)', 'scale(0.94) translateY(6px)')
        .afterClearStyles(['will-change'])
    );
  }

  return root;
}
