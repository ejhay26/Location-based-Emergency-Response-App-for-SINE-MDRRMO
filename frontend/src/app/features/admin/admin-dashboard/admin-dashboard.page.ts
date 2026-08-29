import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuController } from '@ionic/angular';
import { IonContent } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { of, Subscription } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api';
import { UserSettingsService } from '../../../core/services/user-settings';
import { TourService } from '../../../core/services/tour';
import { PushNotificationsService } from '../../../core/services/push-notifications';
import { DesktopNotificationsService } from '../../../core/services/desktop-notifications';
import { AdminUiService } from './admin-ui.service';

import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

import { IncidentMapPanel } from './panels/incident-map/incident-map.panel';
import { AnalyticsPanel } from './panels/analytics/analytics.panel';
import { LogArchivePanel } from './panels/log-archive/log-archive.panel';
import { BroadcastPanel } from './panels/broadcast/broadcast.panel';
import { VerificationsPanel } from './panels/verifications/verifications.panel';
import { DispatchersPanel } from './panels/dispatchers/dispatchers.panel';
import { CitizensPanel } from './panels/citizens/citizens.panel';
import { FeedbackPanel } from './panels/feedback/feedback.panel';
import { SettingsPanel } from './panels/settings/settings.panel';
import { HelpPanel } from './panels/help/help.panel';
import { MobileMenuPanel } from './panels/mobile-menu/mobile-menu.panel';

import { MobileAdminNavComponent } from './components/mobile-admin-nav/mobile-admin-nav.component';

type ViewMode =
  | 'active' | 'hazards' | 'archive' | 'analytics' | 'broadcast'
  | 'verifications' | 'dispatchers' | 'citizens' | 'feedback' | 'settings' | 'help' | 'menu';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  imports: [
    CommonModule,
    IonContent,
    IncidentMapPanel, AnalyticsPanel, LogArchivePanel, BroadcastPanel,
    VerificationsPanel, DispatchersPanel, CitizensPanel, FeedbackPanel,
    SettingsPanel, HelpPanel, MobileMenuPanel, AppIconComponent,
    MobileAdminNavComponent,
  ],
})
export class AdminDashboardPage implements OnInit, OnDestroy {

  currentRole: string | null = '';
  viewMode: ViewMode = 'active';
  lastActiveDesktopView: ViewMode = 'active';
  navDirection: 'forward' | 'back' = 'forward';
  isSidebarCollapsed = false;
  isElectron = false;
  isMoreSheetOpen = false;
  activeIncidentsCount = 0;
  pendingVerificationsCount = 0;

  /** Draggable sidebar width state */
  sidebarWidth = 270;
  readonly MIN_SIDEBAR_WIDTH = 210;
  readonly MAX_SIDEBAR_WIDTH = 440;
  isResizing = false;
  private startX = 0;
  private startWidth = 270;
  private boundMouseMove = this.onMouseMoveResize.bind(this);
  private boundMouseUp = this.onMouseUpResize.bind(this);
  private boundWindowResize = this.onWindowResize.bind(this);

  // Only present in the DOM while viewMode is 'active'/'hazards'; undefined otherwise.
  @ViewChild(IncidentMapPanel) private incidentMapPanel?: IncidentMapPanel;

  isMobileSidebarOpen = false;

  get isDarkMode(): boolean { return this.userSettings.getBool('dark_mode'); }
  get isMapView(): boolean { return this.viewMode === 'active' || this.viewMode === 'hazards'; }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen = false;
  }

  toggleMoreSheet(): void {
    this.isMoreSheetOpen = !this.isMoreSheetOpen;
  }

  closeMoreSheet(): void {
    this.isMoreSheetOpen = false;
  }

  get isSubPanel(): boolean {
    return ['verifications', 'dispatchers', 'citizens', 'analytics', 'feedback', 'settings', 'help'].includes(this.viewMode);
  }

  navigateToSubPanel(mode: ViewMode): void {
    this.navDirection = 'forward';
    this.selectViewMode(mode);
  }

  selectViewMode(mode: ViewMode): void {
    if (mode === 'menu' && this.isSubPanel) {
      this.navDirection = 'back';
    } else if (mode !== 'menu') {
      this.navDirection = 'forward';
      this.lastActiveDesktopView = mode;
    }
    this.viewMode = mode;
    this.isMobileSidebarOpen = false;
    this.isMoreSheetOpen = false;

    // If an interactive tour step is active targeting this view/button, advance tour!
    if (this.tour.isActive()) {
      const target = this.tour.targetId();
      if (
        target === `nav-btn-${mode}` ||
        target === `mobile-tab-${mode}` ||
        target === `menu-item-${mode}` ||
        (mode === 'menu' && (target === 'mobile-nav-back-btn' || target === 'mobile-tab-menu'))
      ) {
        this.tour.next();
      }
    }
  }

  private onWindowResize(): void {
    if (window.innerWidth > 768 && this.viewMode === 'menu') {
      this.selectViewMode(this.lastActiveDesktopView || 'active');
    }
  }

  get currentViewTitle(): string {
    const titles: Record<ViewMode, string> = {
      active: 'Incident Map',
      hazards: 'Public Hazards',
      archive: 'Log Archive',
      analytics: 'Analytics & Trends',
      broadcast: 'Alert Broadcast',
      verifications: 'ID Verifications',
      dispatchers: 'Dispatchers & Teams',
      citizens: 'Citizen Directory',
      feedback: 'Citizen Feedback',
      settings: 'Settings',
      help: 'Help & Guides',
      menu: 'Menu'
    };
    return titles[this.viewMode] || 'MDRRMO';
  }

  private tourSub?: Subscription;

  constructor(
    private router: Router,
    public  api: ApiService,
    private menuCtrl: MenuController,
    private userSettings: UserSettingsService,
    private tour: TourService,
    private pushNotifications: PushNotificationsService,
    private desktopNotifications: DesktopNotificationsService,
    public  ui: AdminUiService,
  ) {}

  ngOnInit() {
    this.tourSub = this.tour.panelChange$.subscribe(panel => {
      if (panel) this.viewMode = panel as ViewMode;
    });

    const stepSub = this.tour.stepChange$.subscribe(({ id, active }) => {
      if (active && id && id.startsWith('nav-btn-')) {
        if (window.innerWidth <= 768) {
          this.isMobileSidebarOpen = true;
        }
      }
    });
    this.tourSub.add(stepSub);

    this.isElectron = (window as unknown as { process?: { versions?: { electron?: string } } }).process?.versions?.electron != null || /electron/i.test(navigator.userAgent);
    
    // Restore saved sidebar width if present
    const savedWidth = localStorage.getItem('admin_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= this.MIN_SIDEBAR_WIDTH && parsed <= this.MAX_SIDEBAR_WIDTH) {
        this.sidebarWidth = parsed;
      }
    }

    // Apply dark mode from the settings service (same source as mobile pages).
    this.userSettings.applyToDom();
    // Stage 5 — desktop alert on new SOS/hazard reports. Dashboard-wide (not
    // tied to whichever sidebar panel is mounted); no-ops itself outside
    // Electron (see DesktopNotificationsService.isElectron).
    this.desktopNotifications.start();
    window.addEventListener('resize', this.boundWindowResize);
  }

  ngOnDestroy() {
    this.tourSub?.unsubscribe();
    this.desktopNotifications.stop();
    this.stopResizeListeners();
    window.removeEventListener('resize', this.boundWindowResize);
  }

  onMouseDownResize(event: MouseEvent) {
    if (this.isSidebarCollapsed) return;
    event.preventDefault();
    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.sidebarWidth;

    document.addEventListener('mousemove', this.boundMouseMove);
    document.addEventListener('mouseup', this.boundMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  private onMouseMoveResize(event: MouseEvent) {
    if (!this.isResizing) return;
    const delta = event.clientX - this.startX;
    let newWidth = this.startWidth + delta;
    if (newWidth < this.MIN_SIDEBAR_WIDTH) newWidth = this.MIN_SIDEBAR_WIDTH;
    if (newWidth > this.MAX_SIDEBAR_WIDTH) newWidth = this.MAX_SIDEBAR_WIDTH;
    this.sidebarWidth = newWidth;
    this.incidentMapPanel?.invalidateMapSize();
  }

  private onMouseUpResize() {
    if (!this.isResizing) return;
    this.isResizing = false;
    this.stopResizeListeners();
    localStorage.setItem('admin_sidebar_width', String(this.sidebarWidth));
    setTimeout(() => {
      this.incidentMapPanel?.invalidateMapSize();
    }, 50);
  }

  private stopResizeListeners() {
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  ionViewWillEnter() {
    this.currentRole = localStorage.getItem('role');
    this.menuCtrl.enable(false);
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      // Load fresh settings from DB so dark mode matches what the admin set.
      this.userSettings.loadFromServer(user.user_id);
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.incidentMapPanel?.invalidateMapSize();
  }

  toggleDarkMode(event: any) {
    const isDark: boolean = event.detail.checked;
    this.userSettings.toggleDarkMode(isDark, event);
  }

  logout() {
    this.ui.confirm({
      title: 'Logout', message: 'Are you sure you want to logout?',
      icon: 'logout', iconColor: 'var(--ion-color-danger)',
      confirmLabel: 'Logout', confirmColor: 'var(--ion-color-danger)',
      // The dialog itself now owns the loading state (its Confirm button
      // shows the spinner and blocks Cancel while this runs) — see
      // DialogService.runConfirm(). Same pattern/rationale as profile.page.ts's
      // logout(): navigation waits for the server round-trip, bounded by
      // timeout(6000) + catchError so a hung/offline connection can't leave
      // the dialog spinning indefinitely.
      onConfirm: () => new Promise<void>(resolve => {
        this.pushNotifications.unregisterPush();
        const finishLogout = () => {
          this.api.clearToken();
          this.userSettings.clear();
          localStorage.clear();
          this.router.navigate(['/login']);
          resolve();
        };
        this.api.logout().pipe(
          timeout(6000),
          catchError(() => of(null)),
        ).subscribe({ next: finishLogout });
      }),
    });
  }
}
