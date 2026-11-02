import { Directive, ElementRef, HostListener, Input, OnDestroy, inject } from '@angular/core';
import { isMacDesktop } from '../utils/platform.util';

/**
 * Custom textbook / comic story dialog tooltip directive.
 * Renders an elevated speech-bubble tooltip with an authentic arrowhead pointing
 * directly to the target element, animated with a subtle spring pop-up action.
 *
 * Usage:
 *   <button [appTooltip]="'Incident Map'" [tooltipSub]="'Live Incident & Hazard Map'" [tooltipKbd]="'Ctrl + 1'">...</button>
 */
@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class CustomTooltipDirective implements OnDestroy {
  @Input('appTooltip') text = '';
  @Input() tooltipSub?: string;
  @Input() tooltipKbd?: string;
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

    // Header row containing title and optional boxed keybindings
    const header = document.createElement('div');
    header.className = 'custom-story-tooltip__header';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'custom-story-tooltip__title';
    titleSpan.textContent = this.text;
    header.appendChild(titleSpan);

    if (this.tooltipKbd) {
      const kbdWrap = document.createElement('span');
      kbdWrap.className = 'custom-story-tooltip__kbd-wrap';

      const isMac = isMacDesktop();
      const rawParts = this.tooltipKbd.split('+').map(p => p.trim());
      rawParts.forEach((part, idx) => {
        if (idx > 0 && !isMac) {
          const plus = document.createElement('span');
          plus.className = 'custom-story-tooltip__plus';
          plus.textContent = '+';
          kbdWrap.appendChild(plus);
        }
        const kbd = document.createElement('kbd');
        kbd.className = 'custom-story-tooltip__kbd';
        let keyText = part;
        if (isMac) {
          const low = keyText.toLowerCase();
          if (low === 'ctrl' || low === 'cmd') keyText = '⌘';
          else if (low === 'alt' || low === 'option') keyText = '⌥';
          else if (low === 'shift') keyText = '⇧';
        }
        kbd.textContent = keyText;
        kbdWrap.appendChild(kbd);
      });
      header.appendChild(kbdWrap);
    }

    tooltip.appendChild(header);

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
    const placed = this.pickPlacement(rect, tipRect);

    const gap = 9;
    const pad = 8;
    const W = window.innerWidth;
    const H = window.innerHeight;

    let top = 0;
    let left = 0;
    let arrowOffset = 0;

    if (placed === 'right') {
      left = rect.right + gap;
      const elemCenterY = rect.top + (rect.height / 2);
      top = elemCenterY - (tipRect.height / 2);
      top = Math.max(pad, Math.min(top, H - pad - tipRect.height));
      arrowOffset = elemCenterY - top;
      arrowOffset = Math.max(12, Math.min(arrowOffset, tipRect.height - 12));
    } else if (placed === 'left') {
      left = rect.left - gap - tipRect.width;
      const elemCenterY = rect.top + (rect.height / 2);
      top = elemCenterY - (tipRect.height / 2);
      top = Math.max(pad, Math.min(top, H - pad - tipRect.height));
      arrowOffset = elemCenterY - top;
      arrowOffset = Math.max(12, Math.min(arrowOffset, tipRect.height - 12));
    } else if (placed === 'top') {
      top = rect.top - gap - tipRect.height;
      const elemCenterX = rect.left + (rect.width / 2);
      left = elemCenterX - (tipRect.width / 2);
      left = Math.max(pad, Math.min(left, W - pad - tipRect.width));
      arrowOffset = elemCenterX - left;
      arrowOffset = Math.max(12, Math.min(arrowOffset, tipRect.width - 12));
    } else {
      top = rect.bottom + gap;
      const elemCenterX = rect.left + (rect.width / 2);
      left = elemCenterX - (tipRect.width / 2);
      left = Math.max(pad, Math.min(left, W - pad - tipRect.width));
      arrowOffset = elemCenterX - left;
      arrowOffset = Math.max(12, Math.min(arrowOffset, tipRect.width - 12));
    }

    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.setProperty('--arrow-offset', `${Math.round(arrowOffset)}px`);
    tooltip.classList.add(`custom-story-tooltip--${placed}`);
    tooltip.classList.add('custom-story-tooltip--active');
  }

  /**
   * Tests sides in priority order (preferred -> opposite -> other sides) and returns
   * the first placement that fits cleanly in the viewport without covering the target element.
   */
  private pickPlacement(r: DOMRect, t: DOMRect): 'right' | 'left' | 'top' | 'bottom' {
    const gap = 9;
    const pad = 8;
    const W = window.innerWidth;
    const H = window.innerHeight;

    const fits: Record<'right' | 'left' | 'top' | 'bottom', boolean> = {
      right:  r.right + gap + t.width <= W - pad,
      left:   r.left - gap - t.width >= pad,
      top:    r.top - gap - t.height >= pad,
      bottom: r.bottom + gap + t.height <= H - pad,
    };

    const opp: Record<'right' | 'left' | 'top' | 'bottom', 'right' | 'left' | 'top' | 'bottom'> = {
      right: 'left',
      left: 'right',
      top: 'bottom',
      bottom: 'top',
    };

    const order: Array<'right' | 'left' | 'top' | 'bottom'> = [
      this.tooltipPlacement,
      opp[this.tooltipPlacement],
      'bottom',
      'top',
      'left',
      'right',
    ];

    const match = order.find(p => fits[p]);
    if (match) return match;

    // Fallback: pick whichever placement has the greatest available clearance
    const clearances: Record<'right' | 'left' | 'top' | 'bottom', number> = {
      right:  W - pad - (r.right + gap),
      left:   r.left - gap - pad,
      top:    r.top - gap - pad,
      bottom: H - pad - (r.bottom + gap),
    };
    return (Object.keys(clearances) as Array<'right' | 'left' | 'top' | 'bottom'>).reduce((best, curr) =>
      clearances[curr] > clearances[best] ? curr : best
    , this.tooltipPlacement);
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

