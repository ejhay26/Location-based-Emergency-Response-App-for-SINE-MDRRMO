import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuController } from '@ionic/angular';
import { IonContent, IonItem, IonLabel, IonToggle } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api';
import { UserSettingsService } from '../../../core/services/user-settings';
import { TourService } from '../../../core/services/tour';
import { PushNotificationsService } from '../../../core/services/push-notifications';
import { DesktopNotificationsService } from '../../../core/services/desktop-notifications';
import { AdminUiService } from './admin-ui.service';

import { IncidentMapPanel } from './panels/incident-map/incident-map.panel';
import { AnalyticsPanel } from './panels/analytics/analytics.panel';
import { LogArchivePanel } from './panels/log-archive/log-archive.panel';
import { BroadcastPanel } from './panels/broadcast/broadcast.panel';
import { VerificationsPanel } from './panels/verifications/verifications.panel';
import { DispatchersPanel } from './panels/dispatchers/dispatchers.panel';
import { CitizensPanel } from './panels/citizens/citizens.panel';
import { FeedbackPanel } from './panels/feedback/feedback.panel';

type ViewMode =
  | 'active' | 'hazards' | 'archive' | 'analytics' | 'broadcast'
  | 'verifications' | 'dispatchers' | 'citizens' | 'feedback';

/**
 * AdminDashboardPage — thin shell. Owns the sidebar nav, dark mode toggle,
 * and logout. The confirm dialog and media lightbox are now rendered once
 * at the true app root (<app-dialogs>, fed by the shared DialogService) —
 * this page just triggers them via AdminUiService the same way every panel
 * does. Everything else is a panel that loads and manages its own state;
 * switching viewMode mounts/unmounts the relevant panel component via
 * *ngIf, matching how each panel's own OnInit/OnDestroy was already written.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  templateUrl: './admin-dashboard.page.html',
  imports: [
    CommonModule,
    IonContent, IonItem, IonLabel, IonToggle,
    IncidentMapPanel, AnalyticsPanel, LogArchivePanel, BroadcastPanel,
    VerificationsPanel, DispatchersPanel, CitizensPanel, FeedbackPanel,
  ],
})
export class AdminDashboardPage implements OnInit, OnDestroy {

  currentRole: string | null = '';
  viewMode: ViewMode = 'active';
  isSidebarCollapsed = false;

  // Only present in the DOM while viewMode is 'active'/'hazards'; undefined otherwise.
  @ViewChild(IncidentMapPanel) private incidentMapPanel?: IncidentMapPanel;

  get isDarkMode(): boolean { return this.userSettings.getBool('dark_mode'); }
  get isMapView(): boolean { return this.viewMode === 'active' || this.viewMode === 'hazards'; }

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
    // Apply dark mode from the settings service (same source as mobile pages).
    this.userSettings.applyToDom();
    // Stage 5 — desktop alert on new SOS/hazard reports. Dashboard-wide (not
    // tied to whichever sidebar panel is mounted); no-ops itself outside
    // Electron (see DesktopNotificationsService.isElectron).
    this.desktopNotifications.start();
  }

  ngOnDestroy() {
    this.desktopNotifications.stop();
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

  ionViewDidEnter() {
    // Auto-start the guided tour for dispatchers on their first login.
    // Uses a localStorage key per user so it only fires once.
    const role = localStorage.getItem('role');
    if (role === 'dispatcher') {
      const userStr = localStorage.getItem('user');
      const userId  = userStr ? JSON.parse(userStr)?.user_id : null;
      const tourKey = `dispatcherTourSeen_${userId}`;
      if (userId && localStorage.getItem(tourKey) !== 'true') {
        localStorage.setItem(tourKey, 'true');
        // Short delay so the map finishes initializing before the tour dims it.
        setTimeout(() => { this.tour.start(); }, 1200);
      }
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.incidentMapPanel?.invalidateMapSize();
  }

  toggleDarkMode(event: any) {
    this.userSettings.setBool('dark_mode', event.detail.checked);
    document.documentElement.classList.toggle('ion-palette-dark', event.detail.checked);
  }

  logout() {
    this.ui.confirm({
      title: 'Logout', message: 'Are you sure you want to logout?',
      icon: 'fa-solid fa-right-from-bracket', iconColor: 'var(--ion-color-danger)',
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
