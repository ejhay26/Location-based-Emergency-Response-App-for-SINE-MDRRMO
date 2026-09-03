import { Component, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { IonToggle } from '@ionic/angular/standalone';
import { UserSettingsService, SettingKey } from '../../../../../core/services/user-settings';
import { AdminUiService } from '../../admin-ui.service';
import { ApiService } from '../../../../../core/services/api';
import { DesktopNotificationsService } from '../../../../../core/services/desktop-notifications';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

interface SettingToggle {
  key: SettingKey;
  label: string;
  hint: (val: boolean) => string;
  value: boolean;
  icon: string;
}

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonToggle,
    AppIconComponent
  ],
  templateUrl: './settings.panel.html',
})
export class SettingsPanel implements OnInit {

  userName = '';
  userEmail = '';
  username = '';
  userRole = '';
  rawRole = 'admin';
  phone = '';

  appearance: SettingToggle[] = [
    { key: 'dark_mode',         label: 'Dark Theme',          hint: v => v ? 'Dark theme is active across the dashboard.' : 'Light theme is active.',               value: false, icon: 'moon' },
    { key: 'reduce_animations', label: 'Reduce Animations',   hint: v => v ? 'Interface animations are minimized.' : 'Full interface animations are active.',       value: false, icon: 'sliders' }
  ];

  notifications: SettingToggle[] = [
    { key: 'notif_emergency_alerts', label: 'Emergency Alerts', hint: v => v ? 'Sound and push alerts for incoming citizen SOS reports are enabled.' : 'SOS alerts are muted.', value: true, icon: 'bell' }
  ];

  mapDefaultStyle = 'street';

  constructor(
    private settings: UserSettingsService,
    private ui: AdminUiService,
    private api: ApiService,
    private desktopNotifications: DesktopNotificationsService,
    private router: Router,
    private elRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        this.userName  = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Officer';
        this.userEmail = u.email || '';
        this.phone     = u.phone || '';
        this.username  = u.username || '';
      } catch {}
    }
    this.rawRole = (localStorage.getItem('role') || 'admin').toLowerCase();
    this.userRole = this.rawRole === 'admin' ? 'SUPERADMIN' : 'DISPATCHER';

    this.appearance.forEach(s => s.value = this.settings.getBool(s.key));
    this.notifications.forEach(s => s.value = this.settings.getBool(s.key));
    this.mapDefaultStyle = this.settings.get('map_default_style') || 'street';
  }

  private lastToggleOrigin: { x: number; y: number } | null = null;

  onTogglePointer(e: any): void {
    const clientX = e?.clientX ?? e?.touches?.[0]?.clientX ?? e?.changedTouches?.[0]?.clientX;
    const clientY = e?.clientY ?? e?.touches?.[0]?.clientY ?? e?.changedTouches?.[0]?.clientY;
    if (typeof clientX === 'number' && typeof clientY === 'number' && clientX > 0 && clientY > 0) {
      this.lastToggleOrigin = { x: Math.round(clientX), y: Math.round(clientY) };
    }
  }

  onToggle(setting: SettingToggle, event?: any): void {
    const isChecked = event?.detail?.checked !== undefined ? event.detail.checked : !setting.value;
    setting.value = isChecked;
    if (setting.key === 'dark_mode') {
      const toggleEl = this.elRef.nativeElement.querySelector('.theme-toggle-live') as HTMLElement | null;
      let originCoords = this.lastToggleOrigin;
      this.lastToggleOrigin = null;

      if (!originCoords && toggleEl && typeof toggleEl.getBoundingClientRect === 'function') {
        const rect = toggleEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          originCoords = {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
          };
        }
      }

      this.settings.toggleDarkMode(isChecked, event, originCoords ?? toggleEl ?? undefined);
    } else {
      this.settings.setBool(setting.key, isChecked);
      if (setting.key === 'reduce_animations') {
        document.documentElement.classList.toggle('reduce-animations', isChecked);
      }
    }
  }

  onMapStyleChange(style: string): void {
    this.mapDefaultStyle = style;
    this.settings.set('map_default_style', style);
    this.ui.showToast(`Default map view set to ${style === 'satellite' ? 'Satellite' : 'Street'}.`, 'medium');
  }

  logout(): void {
    this.ui.confirm({
      title: 'Log Out',
      message: 'Are you sure you want to end your session?',
      icon: 'logout',
      iconColor: '#eb445a',
      confirmLabel: 'Log Out',
      confirmColor: 'danger',
      onConfirm: () => new Promise<void>(resolve => {
        this.desktopNotifications.stop();
        const finishLogout = () => {
          this.settings.clear();
          localStorage.removeItem('api_token');
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          ApiService.isLoggingOut = false;
          this.router.navigate(['/login'], { replaceUrl: true });
          resolve();
        };
        this.api.logout().pipe(
          timeout(4000),
          catchError(() => of(null))
        ).subscribe({
          next: finishLogout,
          error: finishLogout
        });
      })
    });
  }
}
