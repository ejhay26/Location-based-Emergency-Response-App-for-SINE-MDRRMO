export interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
  isCircle: boolean;
  radius: number;
}

export class TourGeometryUtil {

  /** Measures the element with generous padding and detects circle shapes */
  static computeHole(el: HTMLElement, padding = 12): Hole {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const brPx = parseFloat(cs.borderTopLeftRadius) || 0;
    const minDim = Math.min(r.width, r.height);
    const inlineStyle = el.getAttribute('style') || '';
    const isCircle = inlineStyle.includes('border-radius:50%') ||
                     inlineStyle.includes('border-radius: 50%') ||
                     brPx >= minDim * 0.4;

    return {
      top:    r.top    - padding,
      left:   r.left   - padding,
      width:  r.width  + padding * 2,
      height: r.height + padding * 2,
      isCircle,
      radius: isCircle ? 0 : brPx + padding,
    };
  }

  /** Constructs an SVG path for circle or rounded-rect cutout */
  static buildHoleShapePath(hole: Hole): string {
    const { top, left, width, height, isCircle, radius } = hole;
    if (isCircle) {
      const cx = left + width / 2;
      const cy = top + height / 2;
      const rad = Math.max(width, height) / 2;
      return `M${cx - rad},${cy}a${rad},${rad} 0 1,0 ${rad * 2},0a${rad},${rad} 0 1,0 ${-rad * 2},0Z`;
    }
    const rad = Math.max(0, Math.min(radius, width / 2, height / 2));
    const x = left, y = top, w = width, h = height;
    return rad > 0
      ? `M${x + rad},${y}H${x + w - rad}A${rad},${rad} 0 0 1 ${x + w},${y + rad}V${y + h - rad}A${rad},${rad} 0 0 1 ${x + w - rad},${y + h}H${x + rad}A${rad},${rad} 0 0 1 ${x},${y + h - rad}V${y + rad}A${rad},${rad} 0 0 1 ${x + rad},${y}Z`
      : `M${x},${y}H${x + w}V${y + h}H${x}Z`;
  }

  /** Builds CSS clip-path rule with evenodd rule */
  static buildDimClipPath(holePath: string, vw: number, vh: number): string {
    const clip = `path(evenodd, "M0,0H${vw}V${vh}H0Z${holePath}")`;
    return `clip-path:${clip};-webkit-clip-path:${clip};`;
  }

  /** Resolves the target element across both desktop and mobile viewports */
  static resolveElement(id: string): HTMLElement | null {
    if (!id) return null;
    const cleanId = id.startsWith('#') ? id.slice(1) : id;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    // 1. Mobile-specific navigation element targeting
    if (isMobile && cleanId.startsWith('nav-btn-')) {
      const feature = cleanId.replace('nav-btn-', '');
      
      // Bottom navigation tabs (Incident Map, Broadcast, Log Archive)
      const bottomTab = document.getElementById(`mobile-tab-${feature}`);
      if (bottomTab && bottomTab.offsetParent !== null) {
        return bottomTab;
      }

      // Sub-panel items in the Menu list (e.g. ID Verifications, Dispatchers, Analytics)
      const menuItem = document.getElementById(`menu-item-${feature}`);
      if (menuItem && menuItem.offsetParent !== null) {
        return menuItem;
      }

      // If currently on another screen, guide user to the Menu bottom tab
      const menuTab = document.getElementById('mobile-tab-menu');
      if (menuTab && menuTab.offsetParent !== null) {
        return menuTab;
      }
    }

    // 1b. Mobile-specific element ID prefix check (e.g. mobile-verify-actions-group)
    if (isMobile && !cleanId.startsWith('mobile-')) {
      const mobileSpecific = document.getElementById(`mobile-${cleanId}`);
      if (mobileSpecific && (mobileSpecific.offsetParent !== null || mobileSpecific.getBoundingClientRect().width > 0)) {
        return mobileSpecific;
      }
    }

    // 2. Direct ID / selector match across all candidates (finds visible element when responsive desktop & mobile elements both exist in DOM)
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(`#${cleanId}, [id="${cleanId}"]`));
    for (const candidate of candidates) {
      if (candidate.offsetParent !== null) return candidate;
      const r = candidate.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return candidate;
    }

    // 2b. Selector match if id contains CSS selector characters (.class, [attr], spaces)
    if (id.startsWith('.') || id.includes('[') || id.includes(' ')) {
      const selCandidates = Array.from(document.querySelectorAll<HTMLElement>(id));
      for (const candidate of selCandidates) {
        if (candidate.offsetParent !== null) return candidate;
        const r = candidate.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return candidate;
      }
    }

    // 2c. Announcement section alias
    if (cleanId === 'tour-announcement-card' || cleanId === 'tour-announcement-pane') {
      const altEl = document.getElementById('tour-announcement-card') || document.getElementById('tour-announcement-pane');
      if (altEl && altEl.offsetParent !== null) return altEl;
    }

    // 2d. Incident / Hazard category grid alias
    if (cleanId === 'tour-incident-grid' || cleanId === 'tour-hazard-grid') {
      const gridEl = document.getElementById('tour-incident-grid') || document.getElementById('tour-hazard-grid');
      if (gridEl && gridEl.offsetParent !== null) return gridEl;
    }

    // 2e. Map area / location card alias
    if (cleanId === 'tour-location-card' || cleanId === 'tour-map-area') {
      const mapEl = document.getElementById('tour-location-card') || document.getElementById('tour-map-area');
      if (mapEl && mapEl.offsetParent !== null) return mapEl;
    }

    // 2f. Mobile panel aliases
    if (isMobile) {
      if (cleanId === 'admin-map-toolbar' || cleanId === 'cad-map-toolbar') {
        const filterBtn = document.getElementById('mobile-filter-btn');
        if (filterBtn && filterBtn.offsetParent !== null) return filterBtn;
      }
      if (cleanId === 'admin-queue-container' || cleanId === 'cad-queue-container' || cleanId === 'mobile-sheet-cards') {
        const sheet = document.getElementById('mobile-sheet-cards') || document.getElementById('mobile-queue-sheet');
        if (sheet && sheet.offsetParent !== null) return sheet;
      }
    }

    // 3. Fallbacks for sidebar buttons
    if (cleanId.startsWith('nav-btn-')) {
      const feature = cleanId.replace('nav-btn-', '');
      const mobileAlt = document.getElementById(`mobile-tab-${feature}`) ||
                        document.getElementById(`menu-item-${feature}`) ||
                        document.getElementById(`mobile-tab-menu`);
      if (mobileAlt && mobileAlt.offsetParent !== null) return mobileAlt;
    }

    // If candidates were found in DOM but none are visible yet, return null so waitForElement will poll
    if (candidates.length > 0) {
      return null;
    }

    return null;
  }

  /** Adapts tour callout text and interaction hints for mobile vs desktop */
  static getAdaptiveCallout(step: { id: string; callout: string; subtext?: string; interactionHint?: string }): { callout: string; subtext?: string; interactionHint?: string } {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (!isMobile) return step;

    const cleanId = step.id.startsWith('#') ? step.id.slice(1) : step.id;
    if (cleanId.startsWith('nav-btn-')) {
      const feature = cleanId.replace('nav-btn-', '');
      
      // If it's a bottom nav tab
      if (['active', 'broadcast', 'archive'].includes(feature)) {
        const nameMap: Record<string, string> = {
          active: 'Incident Map',
          broadcast: 'Broadcast',
          archive: 'Log Archive'
        };
        return {
          callout: `Step 1: Open ${nameMap[feature]}`,
          subtext: `Tap the ${nameMap[feature]} tab on the bottom navigation bar.`,
          interactionHint: `Tap ${nameMap[feature]} at the bottom`
        };
      }

      // If user is currently looking at the Menu list
      const menuItem = document.getElementById(`menu-item-${feature}`);
      if (menuItem && menuItem.offsetParent !== null) {
        return {
          callout: `Select from Menu`,
          subtext: `Tap this option in the menu list to open its management panel.`,
          interactionHint: `Tap to open`
        };
      }

      // If user needs to open the Menu first
      return {
        callout: `Step 1: Open Menu`,
        subtext: `Tap the Menu tab at the bottom to access this tool.`,
        interactionHint: `Tap Menu tab at the bottom`
      };
    }

    return step;
  }

  /** Calculates the optimal placement coordinates for the floating callout card */
  static calculateCalloutPlacement(hole: Hole, vw: number, vh: number, actualHeight?: number): string {
    const TEXT_H = actualHeight ?? 160;
    const TEXT_W = 360;
    const PAD = 20;

    const holeTop = hole.top;
    const holeBottom = hole.top + hole.height;
    const holeLeft = hole.left;
    const holeRight = hole.left + hole.width;

    const spaceBelow = vh - holeBottom;
    const spaceAbove = holeTop;
    const spaceRight = vw - holeRight;
    const spaceLeft = holeLeft;

    let top: number;
    let left: number;
    const textW = Math.min(TEXT_W, vw - 32);

    // 1. If element is tall (takes up > 55% of screen height, e.g. sidebar or drawer)
    if (hole.height > vh * 0.55) {
      if (spaceRight >= textW + PAD) {
        left = holeRight + PAD;
        top = Math.max(PAD, Math.min(holeTop + 30, vh - TEXT_H - PAD));
      } else if (spaceLeft >= textW + PAD) {
        left = holeLeft - textW - PAD;
        top = Math.max(PAD, Math.min(holeTop + 30, vh - TEXT_H - PAD));
      } else {
        top = spaceBelow >= spaceAbove ? Math.max(PAD, vh - TEXT_H - PAD) : PAD;
        left = (vw - textW) / 2;
      }
    }
    // 2. Standard elements: Prefer placing BELOW or ABOVE
    else if (spaceBelow >= TEXT_H + PAD) {
      top = holeBottom + PAD;
      left = holeLeft + hole.width / 2 - textW / 2;
    } else if (spaceAbove >= TEXT_H + PAD) {
      top = holeTop - TEXT_H - PAD;
      left = holeLeft + hole.width / 2 - textW / 2;
    } else if (spaceRight >= textW + PAD) {
      left = holeRight + PAD;
      top = Math.max(PAD, Math.min(holeTop, vh - TEXT_H - PAD));
    } else if (spaceLeft >= textW + PAD) {
      left = holeLeft - textW - PAD;
      top = Math.max(PAD, Math.min(holeTop, vh - TEXT_H - PAD));
    } else {
      top = spaceBelow > spaceAbove ? Math.max(PAD, vh - TEXT_H - PAD) : PAD;
      left = (vw - textW) / 2;
    }

    // Keep strictly within screen bounds
    left = Math.max(PAD, Math.min(left, vw - textW - PAD));
    top = Math.max(PAD, Math.min(top, vh - TEXT_H - PAD));

    return `top:${top}px;left:${left}px;width:${textW}px;`;
  }
}
