import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuController, AlertController } from '@ionic/angular';
import { IonContent, IonItem, IonLabel, IonToggle } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api';
import { UserSettingsService } from '../../../core/services/user-settings';
import { TourService } from '../../../core/services/tour';
import { PushNotificationsService } from '../../../core/services/push-notifications';
import { AdminUiService } from './admin-ui.service';
import { ProxyImageDirective } from '../../../shared/directives/proxy-image.directive';

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
 * logout, and the ONE shared media lightbox + confirm dialog (driven by
 * AdminUiService's signals). Everything else is a panel that loads and
 * manages its own state; switching viewMode mounts/unmounts the relevant
 * panel component via *ngIf, matching how each panel's own OnInit/OnDestroy
 * was already written.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  templateUrl: './admin-dashboard.page.html',
  imports: [
    CommonModule,
    IonContent, IonItem, IonLabel, IonToggle,
    ProxyImageDirective,
    IncidentMapPanel, AnalyticsPanel, LogArchivePanel, BroadcastPanel,
    VerificationsPanel, DispatchersPanel, CitizensPanel, FeedbackPanel,
  ],
})
export class AdminDashboardPage implements OnInit {

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
    private alertCtrl: AlertController,
    private userSettings: UserSettingsService,
    private tour: TourService,
    private pushNotifications: PushNotificationsService,
    public  ui: AdminUiService,
  ) {}

  ngOnInit() {
    // Apply dark mode from the settings service (same source as mobile pages).
    this.userSettings.applyToDom();
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

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Logout', message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Logout', role: 'destructive', handler: () => {
          this.pushNotifications.unregisterPush();
          this.api.logout().subscribe({ error: () => {} });
          this.api.clearToken();
          this.userSettings.clear();
          localStorage.clear();
          this.router.navigate(['/login']);
        }}
      ]
    });
    await alert.present();
  }
}
