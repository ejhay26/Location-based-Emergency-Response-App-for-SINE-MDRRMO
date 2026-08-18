/**
 * Shared FLIP (First-Last-Invert-Play) reflow helpers.
 *
 * Originally written inline in LogArchivePanel for its sort-order reorder
 * (see that panel's history for the original bug-fix notes). Extracted here
 * so every panel that needs an animated reflow — sort-order changes on a
 * single-column list, OR filter changes on a CSS Grid layout where
 * RevealAnimateDirective's height-collapse trick doesn't reflow correctly —
 * shares one implementation instead of five near-identical copies.
 *
 * Generalized from the original (Y-only, single-column-list) version to
 * translate on BOTH axes: a single-column list reorder only ever moves
 * items vertically, but a CSS Grid filter change can move a surviving card
 * both across columns (X) and between rows (Y), so this must handle both to
 * be correct for grid panels (Citizens, Dispatchers).
 *
 * Note: this file deliberately uses the native Web Animations API
 * (`Element.animate()`) for its actual tween, NOT the `motion` package that
 * the rest of the app's directives (RevealAnimateDirective, ListEnterDirective)
 * use. Animating a plain `HTMLElement` here with Motion's `animate()`
 * hits a TS2769 overload-resolution error against this project's installed
 * `motion` version — it keeps matching the generic
 * `<O extends {}>(object: O, keyframes: ObjectTarget<O>)` overload (meant
 * for animating plain JS objects/MotionValues) instead of the DOM-element
 * overload, no matter whether the keyframes use `transform` or `x`/`y`.
 * WAAPI's `el.animate()` gives the same Promise-based `.finished` API this
 * code needs, with zero type ambiguity and no extra dependency.
 *
 * Usage (call site owns its own @ViewChild container + a `data-flip-id`
 * attribute per rendered item, e.g. `[attr.data-flip-id]="item.id"`):
 *
 *   const before = captureFlipRects(this.container?.nativeElement);
 *   this.someFilterOrSortProperty = newValue;        // triggers Angular's own re-render
 *   requestAnimationFrame(() => {
 *     requestAnimationFrame(() => playFlipReorder(this.container?.nativeElement, before));
 *   });
 *
 * The double rAF is required: the first waits for Angular's change
 * detection (triggered by the property assignment) to actually patch the
 * DOM into its new order/membership; the second waits for the browser to
 * have committed layout for that new state, so the "after" measurement in
 * playFlipReorder is accurate rather than catching an in-between layout.
 */

/**
 * Captures the current bounding rects of every element matching `selector`
 * inside `container`, keyed by that element's `data-flip-id` value. Call
 * this BEFORE the state mutation that will reorder/add/remove elements.
 */
export function captureFlipRects(
  container: HTMLElement | null | undefined,
  selector = '[data-flip-id]',
): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  if (!container) return rects;
  container.querySelectorAll<HTMLElement>(selector).forEach(el => {
    const id = el.dataset['flipId'];
    if (id) rects.set(id, el.getBoundingClientRect());
  });
  return rects;
}

export interface FlipReflowOptions {
  /** Defaults to '[data-flip-id]'. */
  selector?: string;
  /** Tween duration in seconds. Defaults to 0.32. */
  duration?: number;
  /** CSS easing — a `cubic-bezier(...)` string, a CSS easing keyword ('ease-out', 'linear', etc.), or a 4-number array (interpreted as cubic-bezier control points). Defaults to a gentle overshoot ([0.34, 1.3, 0.64, 1]) — see Stage 1's overshoot policy: card-level reflow is exactly the category the spring/bounce feel is meant for. */
  ease?: number[] | string;
}

/** Converts this module's `ease` option into a valid CSS/WAAPI easing string. */
function toCssEasing(ease: number[] | string): string {
  if (Array.isArray(ease)) {
    const [x1, y1, x2, y2] = ease;
    return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  }
  return ease;
}

/**
 * Plays the FLIP "Play" step: for every element matching `selector` inside
 * `container` that also has an entry in `before` (i.e. it was visible
 * before the mutation) and whose position actually changed, snaps it back
 * to its OLD position via an invisible transform, then animates that
 * transform to zero — which is what makes it read as sliding from old
 * position to new rather than teleporting.
 *
 * Elements with no `before` entry (newly-matching items) are left alone —
 * that's ListEnterDirective's job, not this function's.
 *
 * Call this AFTER the DOM mutation has been committed and laid out (see the
 * double-rAF pattern in this file's module doc comment).
 */
export function playFlipReorder(
  container: HTMLElement | null | undefined,
  before: Map<string, DOMRect>,
  options: FlipReflowOptions = {},
): void {
  if (!container || before.size === 0) return;
  const selector = options.selector ?? '[data-flip-id]';
  const durationMs = (options.duration ?? 0.32) * 1000;
  const easing = toCssEasing(options.ease ?? [0.34, 1.3, 0.64, 1]);

  container.querySelectorAll<HTMLElement>(selector).forEach(el => {
    const id = el.dataset['flipId'];
    const oldRect = id ? before.get(id) : undefined;
    if (!oldRect) return; // wasn't visible before this mutation — nothing to reflow FROM

    const newRect = el.getBoundingClientRect();
    const deltaX = oldRect.left - newRect.left;
    const deltaY = oldRect.top - newRect.top;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return; // didn't actually move — nothing to animate

    // Native WAAPI tween — see this file's module doc comment for why this
    // doesn't use the `motion` package here. `el.animate()` is memory-safe
    // on its own: the returned Animation is locally scoped (no field/module
    // reference retains it), and once its effect finishes (or the element
    // is removed from the DOM) the browser releases it for GC without any
    // explicit `.cancel()` needed from us.
    const anim = el.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0px, 0px)' },
      ],
      { duration: durationMs, easing },
    );
    anim.finished
      .then(() => { el.style.transform = ''; })
      .catch(() => { el.style.transform = ''; }); // interrupted by a rapid follow-up change — still land cleanly, never stuck mid-transform
  });
}
