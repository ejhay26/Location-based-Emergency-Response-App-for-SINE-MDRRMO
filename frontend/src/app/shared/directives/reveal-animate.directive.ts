import {
  Directive,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
} from '@angular/core';
import { animate, type AnimationPlaybackControls } from 'motion';
import { UserSettingsService } from '../../core/services/user-settings';

/**
 * Reveal / collapse animation directive.
 *
 * Responsibilities:
 *
 * - Open an element with a fade + height/padding/margin animation.
 * - Close an element with a fade + height/padding/margin animation.
 * - When used on permanently-mounted filtered items, collapse the entire
 *   vertical layout footprint so siblings can reclaim the space.
 * - Safely handle rapid state changes such as:
 *
 *      All -> Resolved -> All -> Resolved
 *
 *   without stale animation callbacks corrupting the current layout.
 *
 * This directive does NOT perform FLIP reflow.
 * FLIP is handled separately by flip-reflow.util.ts.
 */
@Directive({
  selector: '[appRevealAnimate]',
  standalone: true,
})
export class RevealAnimateDirective
  implements AfterViewInit, OnChanges, OnDestroy {

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly settings = inject(UserSettingsService);

  /** true = open/visible, false = collapsed/hidden. */
  @Input('appRevealAnimate') isOpen = true;

  /** Emitted after a close transition has completed. */
  @Output() closed = new EventEmitter<void>();

  private viewReady = false;

  private controls?: AnimationPlaybackControls;

  private rafId?: number;

  /**
   * Animation generation.
   *
   * Every open/close transition gets a new generation number.
   * Old animation callbacks are ignored if a newer transition has started.
   */
  private animationGeneration = 0;

  /**
   * Original CSS spacing.
   *
   * IMPORTANT:
   * These values are captured ONLY ONCE.
   *
   * We must never recapture them while the directive has already collapsed
   * the element, otherwise 0px would incorrectly become the new "resting"
   * padding/margin.
   */
  private spacingCaptured = false;

  private restingMarginTop = '';
  private restingMarginBottom = '';

  private restingPaddingTop = '';
  private restingPaddingBottom = '';

  ngAfterViewInit(): void {
    this.viewReady = true;

    /**
     * Capture the real stylesheet spacing BEFORE this directive modifies it.
     */
    this.captureRestingSpacing();

    if (this.isOpen) {
      this.setOpenImmediately();
    } else {
      this.setClosedImmediately();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;

    if (!changes['isOpen']) return;

    /**
     * Initial state is handled by ngAfterViewInit().
     */
    if (changes['isOpen'].firstChange) return;

    if (this.isOpen) {
      this.playOpen();
    } else {
      this.playClose();
    }
  }

  // ===========================================================================
  // ORIGINAL SPACING
  // ===========================================================================

  /**
   * Capture the element's original vertical spacing ONCE.
   *
   * This is intentionally NOT called during every open/close transition.
   *
   * If we captured it after a close, the computed styles would already be:
   *
   *     margin = 0
   *     padding = 0
   *
   * and the directive would permanently lose the card's original spacing.
   */
  private captureRestingSpacing(): void {
    if (this.spacingCaptured) return;

    const node = this.el.nativeElement;
    const computed = getComputedStyle(node);

    this.restingMarginTop = computed.marginTop;
    this.restingMarginBottom = computed.marginBottom;

    this.restingPaddingTop = computed.paddingTop;
    this.restingPaddingBottom = computed.paddingBottom;

    this.spacingCaptured = true;
  }

  // ===========================================================================
  // ANIMATION CONTROL
  // ===========================================================================

  /**
   * Start a new animation generation and invalidate all previous animations.
   */
  private beginNewAnimation(): number {
    this.animationGeneration++;

    const generation = this.animationGeneration;

    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }

    this.controls?.stop();
    this.controls = undefined;

    return generation;
  }

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.animationGeneration;
  }

  // ===========================================================================
  // IMMEDIATE STATES
  // ===========================================================================

  /**
   * Put the element into a genuine zero-footprint state.
   */
  private setClosedImmediately(): void {
    const node = this.el.nativeElement;

    node.style.overflow = 'hidden';

    node.style.height = '0px';

    node.style.marginTop = '0px';
    node.style.marginBottom = '0px';

    node.style.paddingTop = '0px';
    node.style.paddingBottom = '0px';

    node.style.opacity = '0';
  }

  /**
   * Restore the element to its original CSS-defined state.
   */
  private setOpenImmediately(): void {
    const node = this.el.nativeElement;

    node.style.height = 'auto';

    node.style.marginTop = this.restingMarginTop;
    node.style.marginBottom = this.restingMarginBottom;

    node.style.paddingTop = this.restingPaddingTop;
    node.style.paddingBottom = this.restingPaddingBottom;

    node.style.opacity = '1';

    node.style.overflow = '';
  }

  // ===========================================================================
  // OPEN
  // ===========================================================================

  private playOpen(): void {
    const node = this.el.nativeElement;

    const generation = this.beginNewAnimation();

    /**
     * DO NOT recapture spacing here.
     *
     * The original spacing was already captured during ngAfterViewInit().
     */

    if (!this.settings.shouldAnimate()) {
      this.setOpenImmediately();
      return;
    }

    /**
     * Restore the original spacing first so we can measure the actual open
     * card correctly.
     */
    node.style.overflow = 'hidden';

    node.style.height = 'auto';

    node.style.marginTop = this.restingMarginTop;
    node.style.marginBottom = this.restingMarginBottom;

    node.style.paddingTop = this.restingPaddingTop;
    node.style.paddingBottom = this.restingPaddingBottom;

    node.style.opacity = '1';

    /**
     * Force layout measurement of the fully-open card.
     */
    const targetHeight = node.getBoundingClientRect().height;

    /**
     * Now collapse the card before starting the animation.
     */
    node.style.height = '0px';

    node.style.marginTop = '0px';
    node.style.marginBottom = '0px';

    node.style.paddingTop = '0px';
    node.style.paddingBottom = '0px';

    node.style.opacity = '0';

    /**
     * Let the browser commit the collapsed state first.
     */
    this.rafId = requestAnimationFrame(() => {
      this.rafId = undefined;

      if (!this.isCurrentGeneration(generation)) return;

      this.controls = animate(
        node,
        {
          height: [
            '0px',
            `${targetHeight}px`,
          ],

          opacity: [0, 1],

          marginTop: [
            '0px',
            this.restingMarginTop,
          ],

          marginBottom: [
            '0px',
            this.restingMarginBottom,
          ],

          paddingTop: [
            '0px',
            this.restingPaddingTop,
          ],

          paddingBottom: [
            '0px',
            this.restingPaddingBottom,
          ],
        },
        {
          duration: 0.22,
          ease: 'easeOut',
        }
      );

      const currentAnimation = this.controls;

      currentAnimation.finished
        .then(() => {
          /**
           * Ignore an old animation if the filter has already changed again.
           */
          if (!this.isCurrentGeneration(generation)) return;

          /**
           * Restore the real resting state.
           */
          node.style.height = 'auto';

          node.style.marginTop = this.restingMarginTop;
          node.style.marginBottom = this.restingMarginBottom;

          node.style.paddingTop = this.restingPaddingTop;
          node.style.paddingBottom = this.restingPaddingBottom;

          node.style.opacity = '1';

          node.style.overflow = '';

          this.controls = undefined;
        })
        .catch(() => {
          /**
           * Only recover if this is still the current animation.
           */
          if (!this.isCurrentGeneration(generation)) return;

          this.setOpenImmediately();

          this.controls = undefined;
        });
    });
  }

  // ===========================================================================
  // CLOSE
  // ===========================================================================

  private playClose(): void {
    const node = this.el.nativeElement;

    const generation = this.beginNewAnimation();

    /**
     * DO NOT recapture spacing here.
     *
     * The original margin/padding values must remain unchanged.
     */

    if (!this.settings.shouldAnimate()) {
      this.setClosedImmediately();

      Promise.resolve().then(() => {
        if (this.isCurrentGeneration(generation)) {
          this.closed.emit();
        }
      });

      return;
    }

    /**
     * Restore the original open state before measuring.
     *
     * This makes sure a previous interrupted transition cannot leave us
     * measuring a partially-collapsed card.
     */
    node.style.overflow = 'hidden';

    node.style.height = 'auto';

    node.style.marginTop = this.restingMarginTop;
    node.style.marginBottom = this.restingMarginBottom;

    node.style.paddingTop = this.restingPaddingTop;
    node.style.paddingBottom = this.restingPaddingBottom;

    node.style.opacity = '1';

    /**
     * Measure the fully-open rendered height.
     */
    const startHeight = node.getBoundingClientRect().height;

    /**
     * Lock that height before beginning the collapse.
     */
    node.style.height = `${startHeight}px`;

    this.rafId = requestAnimationFrame(() => {
      this.rafId = undefined;

      if (!this.isCurrentGeneration(generation)) return;

      this.controls = animate(
        node,
        {
          height: [
            `${startHeight}px`,
            '0px',
          ],

          opacity: [1, 0],

          marginTop: [
            this.restingMarginTop,
            '0px',
          ],

          marginBottom: [
            this.restingMarginBottom,
            '0px',
          ],

          paddingTop: [
            this.restingPaddingTop,
            '0px',
          ],

          paddingBottom: [
            this.restingPaddingBottom,
            '0px',
          ],
        },
        {
          duration: 0.20,
          ease: 'easeIn',
        }
      );

      const currentAnimation = this.controls;

      currentAnimation.finished
        .then(() => {
          /**
           * Ignore stale close completions.
           */
          if (!this.isCurrentGeneration(generation)) return;

          /**
           * Leave the card completely collapsed.
           */
          node.style.height = '0px';

          node.style.marginTop = '0px';
          node.style.marginBottom = '0px';

          node.style.paddingTop = '0px';
          node.style.paddingBottom = '0px';

          node.style.opacity = '0';

          node.style.overflow = 'hidden';

          this.controls = undefined;

          this.closed.emit();
        })
        .catch(() => {
          /**
           * If this close was interrupted by a newer state change,
           * the newer animation owns the DOM now.
           */
          if (!this.isCurrentGeneration(generation)) return;

          this.setClosedImmediately();

          this.controls = undefined;

          this.closed.emit();
        });
    });
  }

  // ===========================================================================
  // DESTROY
  // ===========================================================================

  ngOnDestroy(): void {
    this.animationGeneration++;

    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }

    this.controls?.stop();
    this.controls = undefined;
  }
}