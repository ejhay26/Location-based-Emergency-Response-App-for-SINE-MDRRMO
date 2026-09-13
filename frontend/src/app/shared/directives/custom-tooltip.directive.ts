import { Directive, ElementRef, HostListener, Input, OnDestroy, inject } from '@angular/core';

/**
 * Custom textbook / comic story dialog tooltip directive.
 * Renders an elevated speech-bubble tooltip with an authentic arrowhead pointing
 * directly to the target element, animated with a subtle spring pop-up action.
 *
 * Usage:
 *   <button [appTooltip]="'Incident Map'" [tooltipSub]="'Live Incident & Hazard Map'">...</button>
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class CustomTooltipDirective implements OnDestroy {
  @Input('appTooltip') text = '';
  @Input() tooltipSub?: string;
  @Input() tooltipPlacement: 'right' | 'left' | 'top' | 'bottom' = 'right';

  private readonly el = inject(ElementRef<HTMLElement>);
  private tooltipEl: HTMLElement | null = null;
  private showTimeout?: any;

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.text) return;
    this.clearShowTimeout();
    // 60ms delay prevents flashing when moving the cursor quickly across items
    this.showTimeout = setTimeout(() => {
      this.createAndShowTooltip();
    }, 60);
  }

  @HostListener('mouseleave')
  @HostListener('click')
  @HostListener('pointerdown')
  onDismiss(): void {
    this.destroyTooltip();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onWindowChange(): void {
    this.destroyTooltip();
  }

  ngOnDestroy(): void {
    this.destroyTooltip();
  }

  private clearShowTimeout(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = undefined;
    }
  }

  private createAndShowTooltip(): void {
    this.destroyTooltip();
    if (!this.text) return;

    const host = this.el.nativeElement;
    const rect = host.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'custom-story-tooltip';
    tooltip.setAttribute('role', 'tooltip');

    // Title / main text
    const titleSpan = document.createElement('span');
    titleSpan.className = 'custom-story-tooltip__title';
    titleSpan.textContent = this.text;
    tooltip.appendChild(titleSpan);

    // Optional subtext
    if (this.tooltipSub) {
      const subSpan = document.createElement('span');
      subSpan.className = 'custom-story-tooltip__sub';
      subSpan.textContent = this.tooltipSub;
      tooltip.appendChild(subSpan);
    }

    document.body.appendChild(tooltip);
    this.tooltipEl = tooltip;

    // Measure after render to compute placement
    const tipRect = tooltip.getBoundingClientRect();

    let top = 0;
    let left = 0;

    if (this.tooltipPlacement === 'right') {
      left = rect.right + 9;
      top = rect.top + (rect.height / 2) - (tipRect.height / 2);
    } else if (this.tooltipPlacement === 'left') {
      left = rect.left - tipRect.width - 9;
      top = rect.top + (rect.height / 2) - (tipRect.height / 2);
    } else if (this.tooltipPlacement === 'top') {
      left = rect.left + (rect.width / 2) - (tipRect.width / 2);
      top = rect.top - tipRect.height - 8;
    } else {
      left = rect.left + (rect.width / 2) - (tipRect.width / 2);
      top = rect.bottom + 8;
    }

    // Viewport edge collision guards
    const padding = 8;
    if (top < padding) top = padding;
    if (top + tipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - padding - tipRect.height;
    }
    if (left < padding) left = padding;
    if (left + tipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - padding - tipRect.width;
    }

    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.classList.add(`custom-story-tooltip--${this.tooltipPlacement}`);
    tooltip.classList.add('custom-story-tooltip--active');
  }

  private destroyTooltip(): void {
    this.clearShowTimeout();
    if (this.tooltipEl) {
      const el = this.tooltipEl;
      this.tooltipEl = null;
      el.classList.remove('custom-story-tooltip--active');
      el.classList.add('custom-story-tooltip--exit');
      setTimeout(() => {
        el.remove();
      }, 120);
    }
  }
}

