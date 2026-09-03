import { Hole, TourGeometryUtil } from './tour-geometry.util';

/**
 * Spring-based morph animation for the tour overlay spotlight hole.
 * Extracted from TourOverlayComponent to keep the component lean.
 */
export class TourSpringAnimator {
  private animFrameId: number | null = null;
  private _isMorphing = false;

  get isMorphing(): boolean { return this._isMorphing; }

  /**
   * Animate the hole from its current position to the target element's position
   * using a damped spring model for a natural, bouncy feel.
   */
  animateTo(
    currentHole: Hole,
    targetEl: HTMLElement,
    onFrame: (hole: Hole) => void,
    onDone: (finalHole: Hole) => void,
  ): void {
    this.cancel();
    this._isMorphing = true;

    const from = { ...currentHole };
    const to = TourGeometryUtil.computeHole(targetEl);
    const startTime = performance.now();
    const durationMs = 380;
    const zeta = 0.78;
    const omega = 15.0;
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);

    const tick = (now: number) => {
      const elapsed = Math.max(0, (now - startTime) / 1000);
      let progress = 1;

      if (elapsed * 1000 < durationMs) {
        const decay = Math.exp(-zeta * omega * elapsed);
        const oscillation = Math.cos(omegaD * elapsed) +
          ((zeta * omega) / omegaD) * Math.sin(omegaD * elapsed);
        progress = 1 - decay * oscillation;
      }

      const interpolated: Hole = {
        top:      from.top    + (to.top    - from.top)    * progress,
        left:     from.left   + (to.left   - from.left)   * progress,
        width:    from.width  + (to.width  - from.width)  * progress,
        height:   from.height + (to.height - from.height) * progress,
        radius:   from.radius + (to.radius - from.radius) * progress,
        isCircle: progress > 0.5 ? to.isCircle : from.isCircle,
      };

      onFrame(interpolated);

      if (elapsed * 1000 < durationMs) {
        this.animFrameId = requestAnimationFrame(tick);
      } else {
        this._isMorphing = false;
        this.animFrameId = null;
        onDone(to);
      }
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  /** Cancel any in-progress animation */
  cancel(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this._isMorphing = false;
  }
}
