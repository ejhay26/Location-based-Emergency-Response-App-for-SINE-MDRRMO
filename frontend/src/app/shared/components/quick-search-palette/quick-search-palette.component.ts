import {
  Component, ElementRef, ViewChild, computed, effect, HostListener, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import { AppIconComponent } from '../app-icon/app-icon.component';
import { CustomTooltipDirective } from '../../directives/custom-tooltip.directive';
import { BARANGAYS } from '../../constants/barangays';

export interface CommandPaletteItem {
  id: string;
  category: 'Panels' | 'Actions' | 'Barangays';
  title: string;
  subtitle: string;
  icon: string;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
}

@Component({
  selector: 'app-quick-search-palette',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, CustomTooltipDirective],
  templateUrl: './quick-search-palette.component.html',
  styleUrls: ['./quick-search-palette.component.scss'],
})
export class QuickSearchPaletteComponent implements OnInit {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('resultsBody') resultsBody?: ElementRef<HTMLDivElement>;

  searchQuery = '';
  selectedIndex = 0;

  private allItems: CommandPaletteItem[] = [];

  constructor(public shortcuts: KeyboardShortcutsService) {
    // When palette opens, autofocus input and reset query
    effect(() => {
      const isOpen = this.shortcuts.isQuickSearchOpen();
      if (isOpen) {
        this.searchQuery = '';
        this.selectedIndex = 0;
        setTimeout(() => {
          this.searchInput?.nativeElement?.focus();
        }, 50);
      }
    });
  }

  ngOnInit(): void {
    this.buildItems();
  }

  get isMac(): boolean {
    return this.shortcuts.isMac;
  }

  private buildItems(): void {
    const isMac = this.isMac;
    const mod = isMac ? '⌘ ' : 'Ctrl + ';

    this.allItems = [
      // ── Panels & Navigation (Strictly synchronized with sidebar order) ──
      {
        id: 'panel-active',
        category: 'Panels',
        title: 'Incident Map',
        subtitle: 'Live real-time incident map, hazards & dispatch status',
        icon: 'map',
        shortcut: `${mod}1`,
        keywords: ['map', 'incidents', 'hazards', 'live', 'emergency', 'dispatch', 'active'],
        run: () => this.shortcuts.navigateToPanel('active'),
      },
      {
        id: 'panel-archive',
        category: 'Panels',
        title: 'Log Archive',
        subtitle: 'Historical incident logs, archived reports & audits',
        icon: 'history',
        shortcut: `${mod}2`,
        keywords: ['archive', 'logs', 'history', 'resolved', 'past incidents', 'audit'],
        run: () => this.shortcuts.navigateToPanel('archive'),
      },
      {
        id: 'panel-analytics',
        category: 'Panels',
        title: 'Analytics',
        subtitle: 'Performance metrics, dispatch benchmarks & heatmaps',
        icon: 'chart-pie',
        shortcut: `${mod}3`,
        keywords: ['analytics', 'charts', 'response time', 'metrics', 'benchmarks', 'statistics'],
        run: () => this.shortcuts.navigateToPanel('analytics'),
      },
      {
        id: 'panel-broadcast',
        category: 'Panels',
        title: 'Alert Broadcast',
        subtitle: 'Send emergency SMS, push notifications & advisories',
        icon: 'siren',
        shortcut: `${mod}4`,
        keywords: ['broadcast', 'alert', 'announcement', 'sms', 'push', 'warning', 'advisory'],
        run: () => this.shortcuts.navigateToPanel('broadcast'),
      },
      {
        id: 'panel-feedback',
        category: 'Panels',
        title: 'Feedback',
        subtitle: 'Emergency response ratings & citizen reviews',
        icon: 'message-square',
        shortcut: `${mod}5`,
        keywords: ['feedback', 'reviews', 'ratings', 'comments', 'citizen response'],
        run: () => this.shortcuts.navigateToPanel('feedback'),
      },
      {
        id: 'panel-verifications',
        category: 'Panels',
        title: 'ID Verifications',
        subtitle: 'Review pending KYC citizen government IDs & approve accounts',
        icon: 'id-card',
        shortcut: `${mod}6`,
        keywords: ['verification', 'kyc', 'id', 'citizens', 'approve', 'reject', 'pending'],
        run: () => this.shortcuts.navigateToPanel('verifications'),
      },
      {
        id: 'panel-dispatchers',
        category: 'Panels',
        title: 'Dispatchers',
        subtitle: 'Manage MDRRMO dispatcher credentials & permissions',
        icon: 'user-gear',
        shortcut: `${mod}7`,
        keywords: ['dispatchers', 'staff', 'operators', 'personnel', 'team'],
        run: () => this.shortcuts.navigateToPanel('dispatchers'),
      },
      {
        id: 'panel-citizens',
        category: 'Panels',
        title: 'Citizens',
        subtitle: 'Manage registered citizens, contact numbers & addresses',
        icon: 'users',
        shortcut: `${mod}8`,
        keywords: ['citizens', 'directory', 'residents', 'users', 'contacts'],
        run: () => this.shortcuts.navigateToPanel('citizens'),
      },
      {
        id: 'panel-settings',
        category: 'Panels',
        title: 'Settings',
        subtitle: 'MDRRMO system alerts, theme, and workstation options',
        icon: 'settings',
        shortcut: `${mod}9`,
        keywords: ['settings', 'preferences', 'configuration', 'theme', 'audio', 'notifications'],
        run: () => this.shortcuts.navigateToPanel('settings'),
      },
      {
        id: 'panel-help',
        category: 'Panels',
        title: 'Help & Procedures',
        subtitle: 'MDRRMO SOPs, dispatcher guides & tutorials',
        icon: 'graduation-cap',
        shortcut: 'F1',
        keywords: ['help', 'manual', 'procedures', 'sop', 'guide', 'tutorial', 'instructions'],
        run: () => this.shortcuts.navigateToPanel('help'),
      },

      // ── Quick Actions ──
      {
        id: 'action-announcement',
        category: 'Actions',
        title: 'Create New Announcement',
        subtitle: 'Compose an emergency alert broadcast to citizens',
        icon: 'megaphone',
        shortcut: `${mod}N`,
        keywords: ['new', 'announcement', 'create', 'broadcast', 'compose', 'publish'],
        run: () => this.shortcuts.dispatchAction('new-announcement'),
      },
      {
        id: 'action-dark-mode',
        category: 'Actions',
        title: 'Toggle Dark / Light Mode',
        subtitle: 'Switch between sleek dark workstation and high-contrast light',
        icon: 'moon',
        shortcut: `${mod}D`,
        keywords: ['dark', 'light', 'theme', 'mode', 'appearance', 'contrast'],
        run: () => this.shortcuts.dispatchAction('toggle-dark-mode'),
      },
      {
        id: 'action-sidebar',
        category: 'Actions',
        title: 'Toggle Sidebar Collapse',
        subtitle: 'Expand or minimize the left navigation menu',
        icon: 'sliders-horizontal',
        shortcut: `${mod}B`,
        keywords: ['sidebar', 'menu', 'collapse', 'expand', 'hide', 'show'],
        run: () => this.shortcuts.dispatchAction('toggle-sidebar'),
      },
      {
        id: 'action-tour',
        category: 'Actions',
        title: 'Start Interactive Tour',
        subtitle: 'Launch interactive workstation walkthrough guide',
        icon: 'compass',
        keywords: ['tour', 'walkthrough', 'guide', 'tutorial', 'overview'],
        run: () => this.shortcuts.dispatchAction('start-tour'),
      },
      {
        id: 'action-refresh',
        category: 'Actions',
        title: 'Refresh Data & Map Feed',
        subtitle: 'Force re-synchronize active incidents and alerts',
        icon: 'rotate-ccw',
        keywords: ['refresh', 'reload', 'sync', 'update', 're-fetch'],
        run: () => this.shortcuts.dispatchAction('refresh-data'),
      },

      // ── Barangay Map Focus ──
      ...BARANGAYS.map((b) => ({
        id: `bgy-${b.id}`,
        category: 'Barangays' as const,
        title: `Focus: ${b.name}`,
        subtitle: `Filter incident and hazard markers for Barangay ${b.name}`,
        icon: 'map-pin',
        keywords: ['barangay', b.name.toLowerCase(), 'filter', 'zoom', 'locate'],
        run: () => this.shortcuts.jumpToBarangay(b.id),
      })),
    ];
  }

  get filteredItems(): CommandPaletteItem[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.allItems;
    }

    return this.allItems.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(q);
      const subMatch = item.subtitle.toLowerCase().includes(q);
      const catMatch = item.category.toLowerCase().includes(q);
      const kwMatch = item.keywords?.some((k) => k.toLowerCase().includes(q));
      return titleMatch || subMatch || catMatch || kwMatch;
    });
  }

  onInputKeyDown(event: KeyboardEvent): void {
    const list = this.filteredItems;
    if (list.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex + 1) % list.length;
      this.scrollActiveIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex = (this.selectedIndex - 1 + list.length) % list.length;
      this.scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = list[this.selectedIndex];
      if (item) {
        this.selectItem(item);
      }
    }
  }

  selectItem(item: CommandPaletteItem): void {
    item.run();
    this.close();
  }

  close(): void {
    this.shortcuts.closeQuickSearch();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.selectedIndex = 0;
    this.searchInput?.nativeElement?.focus();
  }

  private scrollActiveIntoView(): void {
    setTimeout(() => {
      const selectedEl = this.resultsBody?.nativeElement?.querySelector('.is-selected');
      if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
  }
}
