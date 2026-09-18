import { Injectable, signal, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { isTauri, isMacDesktop } from '../../shared/utils/platform.util';

export type ShortcutActionType =
  | 'toggle-sidebar'
  | 'toggle-dark-mode'
  | 'new-announcement'
  | 'start-tour'
  | 'refresh-data';

export interface ShortcutAction {
  type: ShortcutActionType;
}

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutsService {
  /** Whether the Apple Spotlight / Command Palette quick search is open */
  readonly isQuickSearchOpen = signal<boolean>(false);

  /** Subject emitting panel navigation requests (e.g., 'settings', 'help', 'active', 'broadcast', etc.) */
  readonly panelNavigation$ = new Subject<string>();

  /** Subject emitting quick actions (e.g., toggle sidebar, toggle dark mode, new announcement) */
  readonly action$ = new Subject<ShortcutAction>();

  /** Subject emitting barangay map jump requests */
  readonly barangayJump$ = new Subject<number | 'all'>();

  /** If a navigation occurred from outside admin-dashboard, preserve target panel */
  private pendingPanel: string | null = null;

  private isInitialized = false;

  constructor(private router: Router) {}

  /** Checks if the current session is an admin or dispatcher */
  isAdminOrDispatcher(): boolean {
    const role = localStorage.getItem('role');
    return role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'dispatcher';
  }

  /** Checks if the current session has full administrator privileges */
  isAdmin(): boolean {
    const role = localStorage.getItem('role');
    return role?.toLowerCase() === 'admin';
  }

  get isMac(): boolean {
    return isMacDesktop();
  }

  /**
   * Initialize global keyboard shortcut listener.
   * Safe to call multiple times (idempotent).
   */
  init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    window.addEventListener('keydown', (e: KeyboardEvent) => this.handleGlobalKeyDown(e), { capture: true });

    // Block accidental Ctrl + Mouse Wheel / Pinch page zoom to preserve crisp 1:1 workstation scaling
    window.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
  }

  openQuickSearch(): void {
    if (!this.isAdminOrDispatcher()) return;
    this.isQuickSearchOpen.set(true);
  }

  closeQuickSearch(): void {
    this.isQuickSearchOpen.set(false);
  }

  toggleQuickSearch(): void {
    if (!this.isAdminOrDispatcher()) return;
    this.isQuickSearchOpen.update(open => !open);
  }

  /**
   * Request navigation to an admin dashboard panel (e.g. 'settings', 'help', 'broadcast').
   * If not already on /admin-dashboard, navigates there first.
   * Strictly enforces Role-Based Access Control (RBAC): Dispatchers are blocked from admin panels.
   */
  navigateToPanel(panel: string): void {
    if (!this.isAdminOrDispatcher()) return;

    // Strict RBAC: Dispatchers must never access administrative panels
    const adminOnlyPanels = ['feedback', 'verifications', 'dispatchers', 'citizens'];
    if (!this.isAdmin() && adminOnlyPanels.includes(panel)) {
      return;
    }

    this.closeQuickSearch();

    if (this.router.url.includes('/admin-dashboard')) {
      this.panelNavigation$.next(panel);
    } else {
      this.pendingPanel = panel;
      this.router.navigate(['/admin-dashboard']).then(() => {
        if (this.pendingPanel) {
          setTimeout(() => {
            this.panelNavigation$.next(this.pendingPanel!);
            this.pendingPanel = null;
          }, 100);
        }
      });
    }
  }

  /**
   * Trigger a registered quick action
   */
  dispatchAction(actionType: ShortcutActionType): void {
    this.closeQuickSearch();
    this.action$.next({ type: actionType });
  }

  /** Pending barangay focus target to preserve state across panel mount transitions */
  private pendingBarangayFocus: number | 'all' | null = null;

  /**
   * Trigger a map focus/filter for a specific barangay
   */
  jumpToBarangay(barangayId: number | 'all'): void {
    this.closeQuickSearch();
    this.pendingBarangayFocus = barangayId;
    this.navigateToPanel('active');
    this.barangayJump$.next(barangayId);
    setTimeout(() => {
      this.barangayJump$.next(barangayId);
    }, 120);
  }

  consumeBarangayFocus(): number | 'all' | null {
    const val = this.pendingBarangayFocus;
    this.pendingBarangayFocus = null;
    return val;
  }

  peekBarangayFocus(): number | 'all' | null {
    return this.pendingBarangayFocus;
  }

  consumePendingPanel(): string | null {
    const p = this.pendingPanel;
    this.pendingPanel = null;
    return p;
  }

  private handleGlobalKeyDown(e: KeyboardEvent): void {
    const isMac = this.isMac;
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    const isStaff = this.isAdminOrDispatcher();

    // 1. Suppress developer inspection shortcuts in production builds
    if (!isDevMode() && (isTauri() || !location.hostname.includes('localhost'))) {
      if (
        e.key === 'F12' ||
        (modifier && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (modifier && ['U', 'u'].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // 2. Suppress native browser dialogs & panels that disrupt the desktop workstation:
    // - Ctrl/Cmd + P: Browser Print dialog
    // - Ctrl/Cmd + S: Browser Save Page as HTML dialog
    // - Ctrl/Cmd + O: Browser Open File dialog
    // - Ctrl/Cmd + H: Browser History sidebar
    // - Ctrl/Cmd + J: Browser Downloads drawer
    // - F7: Caret Browsing confirmation prompt
    // - F3: Native browser find bar
    if (
      e.key === 'F7' ||
      e.key === 'F3' ||
      (modifier && ['p', 'P', 's', 'S', 'o', 'O', 'h', 'H', 'j', 'J'].includes(e.key))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 3. Suppress Browser Zoom hotkeys to preserve 1:1 crisp workstation pixel grid:
    // - Ctrl/Cmd + Plus / Equals (+ / =)
    // - Ctrl/Cmd + Minus / Underscore (- / _)
    // - Ctrl/Cmd + 0
    if (
      modifier &&
      (['+', '=', '-', '_', '0'].includes(e.key) || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 4. Suppress Browser History Navigation (leaving app state):
    // - Alt + Left / Right Arrow (Windows / Linux)
    // - Cmd + [ or Cmd + ] (macOS)
    if (
      (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ||
      (isMac && e.metaKey && (e.key === '[' || e.key === ']'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 5. Suppress Hard Browser Reloads (F5, Ctrl/Cmd + R):
    // Reroutes to graceful in-app data refresh instead of blowing away websocket feeds & map state
    if (e.key === 'F5' || (modifier && (e.key === 'r' || e.key === 'R'))) {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) {
        this.dispatchAction('refresh-data');
      }
      return;
    }

    // 2. Escape handling: if Quick Search Palette is open, close it
    if (e.key === 'Escape' && this.isQuickSearchOpen()) {
      e.preventDefault();
      e.stopPropagation();
      this.closeQuickSearch();
      return;
    }

    // 3. F1 or Cmd + ? / Cmd + / -> Help & Procedures panel
    const isHelpKey = e.key === 'F1' || (isMac && e.metaKey && (e.key === '?' || e.key === '/'));
    if (isHelpKey) {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) {
        this.navigateToPanel('help');
      }
      return;
    }

    // 4. Ctrl + , (Windows/Linux) or Cmd + , (macOS) -> Settings panel
    if (modifier && e.key === ',') {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) {
        this.navigateToPanel('settings');
      }
      return;
    }

    // 5. Ctrl + F or Cmd + F AND Ctrl + K or Cmd + K -> Replace default browser find with Quick Search
    if (modifier && (e.key === 'f' || e.key === 'F' || e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) {
        this.toggleQuickSearch();
      }
      return;
    }

    // The remaining shortcut actions only apply to authenticated admin/dispatcher staff
    if (!isStaff) return;

    // 6. Ctrl + B or Cmd + B -> Toggle Sidebar
    if (modifier && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'toggle-sidebar' });
      return;
    }

    // 7. Ctrl + D or Cmd + D -> Toggle Dark Mode
    if (modifier && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'toggle-dark-mode' });
      return;
    }

    // 8. Ctrl + N or Cmd + N -> New Announcement Composer
    if (modifier && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'new-announcement' });
      return;
    }

    // 9. Number keys: Ctrl/Cmd + 1-4 (all staff) & 5-8 (admin only) strictly matching sidebar top-to-bottom order
    if (modifier && !e.shiftKey && !e.altKey) {
      const isAdmin = this.isAdmin();
      switch (e.key) {
        case '1':
          e.preventDefault();
          e.stopPropagation();
          this.navigateToPanel('active');
          break;
        case '2':
          e.preventDefault();
          e.stopPropagation();
          this.navigateToPanel('archive');
          break;
        case '3':
          e.preventDefault();
          e.stopPropagation();
          this.navigateToPanel('analytics');
          break;
        case '4':
          e.preventDefault();
          e.stopPropagation();
          this.navigateToPanel('broadcast');
          break;
        case '5':
          if (isAdmin) {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToPanel('feedback');
          }
          break;
        case '6':
          if (isAdmin) {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToPanel('verifications');
          }
          break;
        case '7':
          if (isAdmin) {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToPanel('dispatchers');
          }
          break;
        case '8':
          if (isAdmin) {
            e.preventDefault();
            e.stopPropagation();
            this.navigateToPanel('citizens');
          }
          break;
      }
    }
  }
}
