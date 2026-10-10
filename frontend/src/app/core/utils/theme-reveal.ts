const DURATION_MS = 520;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

interface ViewTransitionLike {
  ready: Promise<void>;
  finished: Promise<void>;
}

/**
 * Executes a Telegram-style circular expanding/retracting theme reveal via
 * the Web Animations API (WAAPI) and document.startViewTransition.
 *
 * Pre-clips the target pseudo-element before the initial snapshot to eliminate
 * frame-0 flash, and coordinates pseudo-element animation without blocking
 * the main thread.
 */
export async function runThemeReveal(
  isDark: boolean,
  x: number,
  y: number,
  toggle: (isDark: boolean) => void,
): Promise<void> {
  const root = document.documentElement;
  const doc = document as unknown as {
    startViewTransition?: (cb: () => void) => ViewTransitionLike;
  };

  if (typeof doc.startViewTransition !== 'function') {
    toggle(isDark);
    return;
  }

  const originX = Number.isFinite(x) && x >= 0 ? x : Math.round(window.innerWidth / 2);
  const originY = Number.isFinite(y) && y >= 0 ? y : Math.round(window.innerHeight / 2);

  const radius = Math.ceil(
    Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY),
    ),
  );

  const circle = (r: number) => `circle(${r}px at ${originX}px ${originY}px)`;

  // Set before snapshot so frame-0 is pre-clipped and cannot flash solid unclipped color
  root.setAttribute('data-theme-anim', isDark ? 'to-dark' : 'to-light');
  root.style.setProperty('--reveal-zero', circle(0));

  try {
    const vt = doc.startViewTransition.call(document, () => toggle(isDark));
    await vt.ready;

    const keyframes = isDark
      ? [{ clipPath: circle(0) }, { clipPath: circle(radius) }]
      : [{ clipPath: circle(radius) }, { clipPath: circle(0) }];

    const pseudoElement = isDark
      ? '::view-transition-new(root)'
      : '::view-transition-old(root)';

    const animOptions: KeyframeAnimationOptions = {
      duration: DURATION_MS,
      easing: EASING,
      fill: 'forwards',
      pseudoElement,
    };

    root.animate(keyframes, animOptions);
    await vt.finished;
  } catch {
    toggle(isDark);
  } finally {
    root.removeAttribute('data-theme-anim');
    root.style.removeProperty('--reveal-zero');
  }
}
