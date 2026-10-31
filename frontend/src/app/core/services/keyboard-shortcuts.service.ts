import { Injectable, signal, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { isTauri, isMacDesktop } from '../../shared/utils/platform.util';
import { UserSettingsService } from './user-settings';

export type ShortcutActionType =
  | 'toggle-sidebar'
  | 'toggle-dark-mode'
  | 'new-announcement'
  | 'start-tour'
  | 'refresh-data';

export interface ShortcutAction {
  type: ShortcutActionType;
}

export interface KeybindDef {
  id: string;
  label: string;
  category: 'Navigation' | 'Actions';
  defaultKey: string;
  currentKey: string;
}

export const DEFAULT_KEYBINDS: Record<string, string> = {
  'nav-map': '1',
  'nav-archive': '2',
  'nav-analytics': '3',
  'nav-broadcast': '4',
  'nav-feedback': '5',
  'nav-verify': '6',
  'nav-dispatchers': '7',
  'nav-citizens': '8',
  'nav-settings': ',',
  'nav-help': 'F1',
  'action-search': 'F',
  'action-sidebar': 'B',
  'action-darkmode': 'D',
  'action-announcement': 'N',
  'action-refresh': 'R',
};

const KEYBIND_STORAGE_KEY = 'sine_custom_keybinds';

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

  /** Subject emitting back, forward, or escape navigation / modal dismissal requests */
  readonly backAction$ = new Subject<'back' | 'forward' | 'escape'>();

  /** If a navigation occurred from outside admin-dashboard, preserve target panel */
  private pendingPanel: string | null = null;

  private isInitialized = false;

  private keybindMap: Record<string, string> = { ...DEFAULT_KEYBINDS };

  constructor(private router: Router, private userSettings: UserSettingsService) {
    this.hydrateKeybinds();
  }

  private hydrateKeybinds(): void {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(KEYBIND_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          this.keybindMap = { ...DEFAULT_KEYBINDS, ...parsed };
        }
      } catch {}
    }
  }

  getKeybind(id: string): string {
    return this.keybindMap[id] || DEFAULT_KEYBINDS[id] || '';
  }

  setKeybind(id: string, key: string): void {
    if (!id || !key) return;
    this.keybindMap[id] = key.toUpperCase();
    try {
      localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify(this.keybindMap));
    } catch {}
  }

  resetKeybinds(): void {
    this.keybindMap = { ...DEFAULT_KEYBINDS };
    try {
      localStorage.removeItem(KEYBIND_STORAGE_KEY);
    } catch {}
  }

  getKeybindList(): KeybindDef[] {
    const list: { id: string; label: string; category: 'Navigation' | 'Actions' }[] = [
      { id: 'nav-map',          label: 'Incident Map',            category: 'Navigation' },
      { id: 'nav-archive',      label: 'Log Archive',             category: 'Navigation' },
      { id: 'nav-analytics',    label: 'Analytics',               category: 'Navigation' },
      { id: 'nav-broadcast',    label: 'Alert Broadcast',         category: 'Navigation' },
      { id: 'nav-feedback',     label: 'Feedback Inbox',          category: 'Navigation' },
      { id: 'nav-verify',       label: 'ID Verifications',        category: 'Navigation' },
      { id: 'nav-dispatchers',  label: 'Dispatcher Management',   category: 'Navigation' },
      { id: 'nav-citizens',     label: 'Citizen Directory',       category: 'Navigation' },
      { id: 'nav-settings',     label: 'Settings Panel',          category: 'Navigation' },
      { id: 'nav-help',         label: 'Help & Procedures',       category: 'Navigation' },
      { id: 'action-search',    label: 'Command Search Palette',  category: 'Actions' },
      { id: 'action-sidebar',   label: 'Toggle Navigation Sidebar',category: 'Actions' },
      { id: 'action-darkmode',  label: 'Toggle Dark / Light Theme',category: 'Actions' },
      { id: 'action-announcement', label: 'Create Announcement',   category: 'Actions' },
      { id: 'action-refresh',   label: 'Refresh Operational Feeds',category: 'Actions' },
    ];

    return list.map(item => ({
      ...item,
      defaultKey: DEFAULT_KEYBINDS[item.id] || '',
      currentKey: this.getKeybind(item.id),
    }));
  }

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

  init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    window.addEventListener('keydown', (e: KeyboardEvent) => this.handleGlobalKeyDown(e), { capture: true });

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

  navigateToPanel(panel: string): void {
    if (!this.isAdminOrDispatcher()) return;
    const currentUrl = this.router.url;
    if (currentUrl.includes('/admin-dashboard')) {
      this.panelNavigation$.next(panel);
    } else {
      this.pendingPanel = panel;
      this.router.navigate(['/admin-dashboard']);
    }
  }

  dispatchAction(type: ShortcutActionType): void {
    if (!this.isAdminOrDispatcher()) return;
    this.action$.next({ type });
  }

  consumePendingPanel(): string | null {
    const p = this.pendingPanel;
    this.pendingPanel = null;
    return p;
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

  private handleGlobalKeyDown(e: KeyboardEvent): void {
    const isMac = this.isMac;
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    const isStaff = this.isAdminOrDispatcher();

    // 1. Universal Command Search: modifier + Key or modifier + K
    const searchKey = this.getKeybind('action-search').toUpperCase();
    if (modifier && (e.key.toUpperCase() === searchKey || e.key.toUpperCase() === 'K')) {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) this.toggleQuickSearch();
      return;
    }

    // 2. Escape closes modals or quick search
    if (e.key === 'Escape') {
      if (this.isQuickSearchOpen()) {
        e.preventDefault();
        e.stopPropagation();
        this.closeQuickSearch();
        return;
      }
      this.backAction$.next('escape');
      return;
    }

    // 3. Zoom Controls
    if (modifier && (['+', '=', 'NumpadAdd'].includes(e.key) || e.code === 'NumpadAdd')) {
      e.preventDefault();
      e.stopPropagation();
      this.userSettings.zoomIn();
      return;
    }
    if (modifier && (['-', '_', 'NumpadSubtract'].includes(e.key) || e.code === 'NumpadSubtract')) {
      e.preventDefault();
      e.stopPropagation();
      this.userSettings.zoomOut();
      return;
    }
    if (modifier && (e.key === '0' || e.code === 'Numpad0')) {
      e.preventDefault();
      e.stopPropagation();
      this.userSettings.resetZoom();
      return;
    }

    // 4. Alt + Arrow Keys Navigation
    if ((e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowDown')) || (isMac && e.metaKey && e.key === '[')) {
      e.preventDefault();
      e.stopPropagation();
      this.backAction$.next('back');
      return;
    }
    if ((e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowUp')) || (isMac && e.metaKey && e.key === ']')) {
      e.preventDefault();
      e.stopPropagation();
      this.backAction$.next('forward');
      return;
    }

    // 5. Help Key (F1 or custom)
    const helpKey = this.getKeybind('nav-help').toUpperCase();
    if (e.key.toUpperCase() === helpKey || (helpKey === 'F1' && e.key === 'F1') || (isMac && e.metaKey && (e.key === '?' || e.key === '/'))) {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) this.navigateToPanel('help');
      return;
    }

    // 6. Settings Panel
    const settingsKey = this.getKeybind('nav-settings').toUpperCase();
    if (modifier && e.key.toUpperCase() === settingsKey) {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) this.navigateToPanel('settings');
      return;
    }

    // 7. Refresh Data
    const refreshKey = this.getKeybind('action-refresh').toUpperCase();
    if (e.key === 'F5' || (modifier && e.key.toUpperCase() === refreshKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) this.dispatchAction('refresh-data');
      return;
    }

    // Remaining shortcuts require authenticated staff
    if (!isStaff) return;

    // 8. Toggle Sidebar
    const sidebarKey = this.getKeybind('action-sidebar').toUpperCase();
    if (modifier && e.key.toUpperCase() === sidebarKey) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'toggle-sidebar' });
      return;
    }

    // 9. Toggle Dark Mode
    const darkKey = this.getKeybind('action-darkmode').toUpperCase();
    if (modifier && e.key.toUpperCase() === darkKey) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'toggle-dark-mode' });
      return;
    }

    // 10. New Announcement
    const annKey = this.getKeybind('action-announcement').toUpperCase();
    if (modifier && e.key.toUpperCase() === annKey) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'new-announcement' });
      return;
    }

    // 11. Custom or Standard Number Navigation Keys (Ctrl/Cmd + 1-8)
    if (modifier && !e.shiftKey && !e.altKey) {
      const isAdmin = this.isAdmin();
      const currentUpper = e.key.toUpperCase();

      if (currentUpper === this.getKeybind('nav-map').toUpperCase()) {
        e.preventDefault();
        this.navigateToPanel('active');
        return;
      }
      if (currentUpper === this.getKeybind('nav-archive').toUpperCase()) {
        e.preventDefault();
        this.navigateToPanel('archive');
        return;
      }
      if (currentUpper === this.getKeybind('nav-analytics').toUpperCase()) {
        e.preventDefault();
        this.navigateToPanel('analytics');
        return;
      }
      if (currentUpper === this.getKeybind('nav-broadcast').toUpperCase()) {
        e.preventDefault();
        this.navigateToPanel('broadcast');
        return;
      }
      if (isAdmin && currentUpper === this.getKeybind('nav-feedback').toUpperCase()) {
        e.preventDefault();
        this.navigateToPanel('feedback');
        return;
      }
      if (isAdmin && currentUpper === this.getKeybind('nav-verify').toUpperCase()) {
        e.preventDefault();
        this.navigateToPanel('verifications');
        return;
      }
      if (isAdmin && currentUpper === this.getKeybind('nav-dispatchers').toUpperCase()) {
        e.preventDefault();
        this.navigateToPanel('dispatchers');
        return;
      }
      if (isAdmin && currentUpper === this.getKeybind('nav-citizens').toUpperCase()) {
        e.preventDefault();
        this.navigateToPanel('citizens');
        return;
      }
    }
  }
}
