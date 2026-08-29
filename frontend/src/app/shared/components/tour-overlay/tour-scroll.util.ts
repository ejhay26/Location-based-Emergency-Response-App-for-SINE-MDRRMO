import { TourGeometryUtil } from './tour-geometry.util';

/**
 * Utilities for scrolling tour target elements into view and
 * waiting for DOM elements to appear.
 * Extracted from TourOverlayComponent for maintainability.
 */
export class TourScrollUtil {

  /**
   * Find the nearest scrollable parent of an element (including
   * Ionic's ion-content shadow DOM scroll container).
   */
  static findScrollParent(el: HTMLElement): Element | null {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
        return node;
      }
      node = node.parentElement;
    }
    const ionContent = el.closest('ion-content') as any;
    return ionContent?.shadowRoot?.querySelector('[part="scroll"]') ?? null;
  }

  /**
   * Check if an element is fully visible within the viewport.
   */
  static isInView(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight &&
           r.left >= 0 && r.right <= window.innerWidth;
  }

  /**
   * Smoothly scroll a target element into view within its scroll parent.
   * Returns a Promise that resolves when scrolling is settled.
   */
  static scrollIntoView(el: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      const scrollParent = this.findScrollParent(el);
      if (!scrollParent) {
        resolve();
        return;
      }

      const parentRect = scrollParent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const desiredTop = parentRect.top + parentRect.height * 0.28;
      const delta = elRect.top - desiredTop;

      if (Math.abs(delta) <= 28) {
        resolve();
        return;
      }

      scrollParent.scrollBy({ top: delta, behavior: 'smooth' });

      let settled = false;
      const onSettled = () => {
        if (settled) return;
        settled = true;
        scrollParent.removeEventListener('scrollend', onSettled);
        clearTimeout(fallbackTimeout);
        resolve();
      };

      scrollParent.addEventListener('scrollend', onSettled, { once: true });
      const fallbackTimeout = setTimeout(onSettled, 180);
    });
  }

  /**
   * Wait for a DOM element to appear and have non-zero dimensions.
   * Retries up to `maxRetries` times with `intervalMs` between each.
   * Returns null if the element is never found.
   */
  static waitForElement(
    id: string,
    maxRetries = 30,
    intervalMs = 60,
  ): Promise<HTMLElement | null> {
    return new Promise(resolve => {
      let attempt = 0;

      const tryFind = () => {
        const el = TourGeometryUtil.resolveElement(id);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            resolve(el);
            return;
          }
        }

        attempt++;
        if (attempt < maxRetries) {
          setTimeout(tryFind, intervalMs);
        } else {
          resolve(null);
        }
      };

      tryFind();
    });
  }
}
