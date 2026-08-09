import { Directive, ElementRef, Input, Output, EventEmitter, AfterViewInit, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { animate, type AnimationPlaybackControls } from 'motion';
import { UserSettingsService } from '../../core/services/user-settings';

/**
 * Stage 5 (+ post-Stage-5 close-animation follow-up) — plays a fade +
 * height-reveal animation both when this element opens AND when it closes.
 *
 * Usage — the host component keeps the element mounted for the duration of
 * the close animation instead of yanking it out via `*ngIf` the instant the
 * state flips. The standard pattern (see History cards / Help FAQ / Profile
 * password-security for reference implementations):
 *
 *   <div *ngIf="isOpen || isClosing"
 *        [appRevealAnimate]="isOpen"
 *        (closed)="onCollapsed()">
 *     ...
 *   </div>
 *
 * - `[appRevealAnimate]="isOpen"` (true) plays the open tween (unchanged
 *   from the original Stage 5 behavior).
 * - Flipping the input to `false` while still mounted plays a close tween
 *   (height + opacity back down to 0) and emits `(closed)` once it
 *   finishes, which is the host's cue to flip `isClosing` back to `false`
 *   so `*ngIf` actually unmounts the element.
 * - If `reduce_animations` is on, both directions resolve instantly
 *   (`closed` still fires, synchronously via a microtask, so callers don't
 *   need to special-case the disabled-animation path).
 *
 * Used for: History card expand bodies, Help FAQ answers, and the Profile
 * password-change step transitions.
 */
@Directive({
  selector: '[appRevealAnimate]',
  standalone: true,
})
export class RevealAnimateDirective implements AfterViewInit, OnChanges, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly settings = inject(UserSettingsService);

  /** true = animate open (or start open on first render); false = animate closed. */
  @Input('appRevealAnimate') isOpen = true;
  /** Fires once the close tween (or its instant no-animation equivalent) has finished. */
  @Output() closed = new EventEmitter<void>();

  private rafId?: number;
  private controls?: AnimationPlaybackControls;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.isOpen) this.playOpen();
    // If the element is created already-closed (shouldn't normally happen
    // given the `*ngIf="isOpen || isClosing"` usage pattern, but guarded
    // defensively), there's nothing to animate — it's already collapsed.
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Skip the very first change (handled by ngAfterViewInit instead, so we
    // don't race the initial-height measurement against a not-yet-rendered
    // node) and any change that fires before the view is actually ready.
    if (!this.viewReady || changes['isOpen']?.firstChange) return;
    this.isOpen ? this.playOpen() : this.playClose();
  }

  private cancelPending(): void {
    if (this.rafId !== undefined) { cancelAnimationFrame(this.rafId); this.rafId = undefined; }
    this.controls?.stop();
  }

  private playOpen(): void {
    const node = this.el.nativeElement;
    this.cancelPending();

    if (!this.settings.shouldAnimate()) {
      node.style.height = '';
      node.style.opacity = '';
      node.style.overflow = '';
      return;
    }

    const targetHeight = node.scrollHeight;
    node.style.overflow = 'hidden';
    node.style.height = '0px';
    node.style.opacity = '0';

    // Defer to next frame so the browser paints the collapsed (0px) state
    // first, instead of jumping straight from full height to 0 with no
    // visible starting frame.
    this.rafId = requestAnimationFrame(() => {
      this.controls = animate(
        node,
        { height: ['0px', `${targetHeight}px`], opacity: [0, 1] },
        { duration: 0.22, ease: 'easeOut' }
      );
      this.controls.finished
        .then(() => {
          // Release back to 'auto' once settled so the element still
          // reflows correctly if its content changes size afterward
          // (e.g. an image finishing its own async load).
          node.style.height = 'auto';
          node.style.overflow = '';
        })
        .catch(() => { /* interrupted — nothing to clean up */ });
    });
  }

  private playClose(): void {
    const node = this.el.nativeElement;
    this.cancelPending();

    if (!this.settings.shouldAnimate()) {
      // Resolve on a microtask rather than synchronously — emitting during
      // the same change-detection pass that produced this ngOnChanges call
      // risks an ExpressionChangedAfterItHasBeenCheckedError if the host
      // reads `isClosing` in its own template.
      Promise.resolve().then(() => this.closed.emit());
      return;
    }

    // Measure the currently-rendered (open) height as the animation's
    // start point, since the node may already be at 'auto' from a prior
    // open tween settling.
    const startHeight = node.scrollHeight;
    node.style.overflow = 'hidden';
    node.style.height = `${startHeight}px`;

    this.rafId = requestAnimationFrame(() => {
      this.controls = animate(
        node,
        { height: [`${startHeight}px`, '0px'], opacity: [1, 0] },
        { duration: 0.2, ease: 'easeIn' }
      );
      this.controls.finished
        .then(() => this.closed.emit())
        .catch(() => this.closed.emit()); // interrupted (e.g. host destroyed) — still let the host know
    });
  }

  ngOnDestroy(): void {
    // Memory-safety: cancel a still-pending rAF and stop a running tween so
    // neither can go on to touch a detached DOM node after removal.
    this.cancelPending();
  }
}
