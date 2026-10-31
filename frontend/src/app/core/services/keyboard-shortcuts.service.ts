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
  'nav-map': 'Ctrl + 1',
  'nav-archive': 'Ctrl + 2',
  'nav-analytics': 'Ctrl + 3',
  'nav-broadcast': 'Ctrl + 4',
  'nav-feedback': 'Ctrl + 5',
  'nav-verify': 'Ctrl + 6',
  'nav-dispatchers': 'Ctrl + 7',
  'nav-citizens': 'Ctrl + 8',
  'nav-settings': 'Ctrl + ,',
  'nav-help': 'F1',
  'action-search': 'Ctrl + F',
  'action-sidebar': 'Ctrl + B',
  'action-darkmode': 'Ctrl + D',
  'action-announcement': 'Ctrl + N',
  'action-refresh': 'F5',
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

  static formatKeyEvent(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.metaKey) parts.push('Cmd');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let key = e.key;
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
      return '';
    }
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();

    parts.push(key);
    return parts.join(' + ');
  }

  setKeybind(id: string, combo: string): { success: boolean; conflictWith?: { id: string; label: string } } {
    if (!id || !combo) return { success: false };
    const norm = combo.trim();

    // Check for conflict with other actions
    const list = this.getKeybindList();
    const conflict = list.find(item => item.id !== id && item.currentKey.toLowerCase() === norm.toLowerCase());
    if (conflict) {
      return { success: false, conflictWith: { id: conflict.id, label: conflict.label } };
    }

    this.keybindMap[id] = norm;
    try {
      localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify(this.keybindMap));
    } catch {}
    return { success: true };
  }

  resetIndividualKeybind(id: string): string {
    const def = DEFAULT_KEYBINDS[id] || '';
    this.keybindMap[id] = def;
    try {
      localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify(this.keybindMap));
    } catch {}
    return def;
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
    const isStaff = this.isAdminOrDispatcher();
    const combo = KeyboardShortcutsService.formatKeyEvent(e);
    if (!combo) return;

    // Check if user is typing in a form field
    const activeEl = document.activeElement;
    const tagName = activeEl ? activeEl.tagName.toLowerCase() : '';
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'ion-textarea' || tagName === 'select' || activeEl?.getAttribute('contenteditable') === 'true';

    // Single-character shortcuts without modifiers should NOT fire while typing in an input
    const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
    if (isInput && !hasModifier && !e.key.startsWith('F') && e.key !== 'Escape') {
      return;
    }

    const comboLower = combo.toLowerCase();

    // 1. Universal Command Search: matches action-search, or Ctrl/Cmd + K
    const searchCombo = this.getKeybind('action-search').toLowerCase();
    if (comboLower === searchCombo || comboLower === 'ctrl + k' || comboLower === 'cmd + k') {
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
    const modifier = isMac ? e.metaKey : e.ctrlKey;
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

    // 5. Help Key
    if (comboLower === this.getKeybind('nav-help').toLowerCase() || e.key === 'F1') {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) this.navigateToPanel('help');
      return;
    }

    // 6. Settings Panel
    if (comboLower === this.getKeybind('nav-settings').toLowerCase()) {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) this.navigateToPanel('settings');
      return;
    }

    // 7. Refresh Data
    if (comboLower === this.getKeybind('action-refresh').toLowerCase() || e.key === 'F5') {
      e.preventDefault();
      e.stopPropagation();
      if (isStaff) this.dispatchAction('refresh-data');
      return;
    }

    // Remaining shortcuts require authenticated staff
    if (!isStaff) return;

    // 8. Toggle Sidebar
    if (comboLower === this.getKeybind('action-sidebar').toLowerCase()) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'toggle-sidebar' });
      return;
    }

    // 9. Toggle Dark Mode
    if (comboLower === this.getKeybind('action-darkmode').toLowerCase()) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'toggle-dark-mode' });
      return;
    }

    // 10. New Announcement
    if (comboLower === this.getKeybind('action-announcement').toLowerCase()) {
      e.preventDefault();
      e.stopPropagation();
      this.action$.next({ type: 'new-announcement' });
      return;
    }

    // 11. Navigation Shortcuts
    const isAdmin = this.isAdmin();
    if (comboLower === this.getKeybind('nav-map').toLowerCase()) {
      e.preventDefault();
      this.navigateToPanel('active');
      return;
    }
    if (comboLower === this.getKeybind('nav-archive').toLowerCase()) {
      e.preventDefault();
      this.navigateToPanel('archive');
      return;
    }
    if (comboLower === this.getKeybind('nav-analytics').toLowerCase()) {
      e.preventDefault();
      this.navigateToPanel('analytics');
      return;
    }
    if (comboLower === this.getKeybind('nav-broadcast').toLowerCase()) {
      e.preventDefault();
      this.navigateToPanel('broadcast');
      return;
    }
    if (isAdmin && comboLower === this.getKeybind('nav-feedback').toLowerCase()) {
      e.preventDefault();
      this.navigateToPanel('feedback');
      return;
    }
    if (isAdmin && comboLower === this.getKeybind('nav-verify').toLowerCase()) {
      e.preventDefault();
      this.navigateToPanel('verifications');
      return;
    }
    if (isAdmin && comboLower === this.getKeybind('nav-dispatchers').toLowerCase()) {
      e.preventDefault();
      this.navigateToPanel('dispatchers');
      return;
    }
    if (isAdmin && comboLower === this.getKeybind('nav-citizens').toLowerCase()) {
      e.preventDefault();
      this.navigateToPanel('citizens');
      return;
    }
  }
}
