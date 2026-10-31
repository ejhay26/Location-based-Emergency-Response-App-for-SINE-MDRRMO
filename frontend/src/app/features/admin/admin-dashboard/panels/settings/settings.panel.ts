import { Component, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Platform } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { IonToggle, IonRange } from '@ionic/angular/standalone';
import { UserSettingsService, SettingKey } from '../../../../../core/services/user-settings';
import { AdminUiService } from '../../admin-ui.service';
import { ApiService } from '../../../../../core/services/api';
import { DesktopNotificationsService } from '../../../../../core/services/desktop-notifications';
import { AudioService, AVAILABLE_SOUNDS, SoundOption } from '../../../../../core/services/audio.service';
import { KeyboardShortcutsService, KeybindDef } from '../../../../../core/services/keyboard-shortcuts.service';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';
import { CustomTooltipDirective } from '../../../../../shared/directives/custom-tooltip.directive';

export type SettingsSubPage = 'main' | 'appearance' | 'audio' | 'map' | 'keybinds' | 'notifications' | 'account';

interface SettingToggle {
  key: SettingKey;
  label: string;
  hint: (val: boolean) => string;
  value: boolean;
  icon: string;
}

interface IncidentSoundProfile {
  key: string;
  label: string;
  icon: string;
  color: string;
  soundId: string;
  volume: number;
}

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonToggle, IonRange,
    AppIconComponent, CustomTooltipDirective
  ],
  templateUrl: './settings.panel.html',
  styleUrls: ['./settings.panel.scss']
})
export class SettingsPanel implements OnInit, OnDestroy {

  activeSubPage: SettingsSubPage = 'main';
  isExitingSubPage = false;
  private exitTimer: any = null;
  private backButtonSub?: Subscription;

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
    { key: 'notif_emergency_alerts', label: 'Emergency Alerts', hint: v => v ? 'Desktop alerts for incoming citizen SOS reports are active.' : 'Desktop alerts are muted.', value: true, icon: 'bell' },
    { key: 'notif_sound_effects',    label: 'Sound Effects & Chimes', hint: v => v ? 'Audible chimes on new emergencies and tactile interaction feedback are active.' : 'All system audio is muted.', value: true, icon: 'volume-2' }
  ];

  mapDefaultStyle: 'street' | 'satellite' = 'street';

  availableSounds: SoundOption[] = AVAILABLE_SOUNDS;

  incidentSoundProfiles: IncidentSoundProfile[] = [
    { key: 'fire',     label: 'Fire Incident',      icon: 'flame',         color: '#eb445a', soundId: 'alert_urgent',   volume: 100 },
    { key: 'flood',    label: 'Flood Incident',     icon: 'droplet',       color: '#3880ff', soundId: 'sonar_depth',    volume: 100 },
    { key: 'medical',  label: 'Medical Incident',   icon: 'medical',       color: '#2dd36f', soundId: 'chime_harmonic', volume: 100 },
    { key: 'crime',    label: 'Crime & Security',   icon: 'shield-alert',  color: '#bc6fff', soundId: 'siren_chirp',    volume: 100 },
    { key: 'hazard',   label: 'Hazard Alert',       icon: 'hazard',        color: '#ffc409', soundId: 'beacon_radar',   volume: 100 },
    { key: 'default',  label: 'General SOS',        icon: 'alert-triangle',color: '#92949c', soundId: 'chime_harmonic', volume: 100 },
  ];

  recordingKeybindId: string | null = null;
  private keyRecordingListener: ((e: KeyboardEvent) => void) | null = null;

  keybindList: KeybindDef[] = [];
  availableKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', ',', '.', '/'];

  get currentZoom(): number {
    return this.settings.getZoom();
  }

  onZoomChange(event: any): void {
    const val = event?.detail?.value;
    if (typeof val === 'number') {
      this.settings.setZoom(val);
    }
  }

  resetZoom(): void {
    this.settings.setZoom(100);
  }

  get soundVolume(): number {
    return Math.round(this.audio.getVolume() * 100);
  }

  onSoundVolumeChange(event: any): void {
    const val = Number(event.target?.value ?? event.detail?.value);
    if (!isNaN(val)) {
      this.audio.setVolume(val / 100);
    }
  }

  resetSoundVolume(): void {
    this.audio.setVolume(1.0);
  }

  testAudioSound(): void {
    this.audio.testChime();
    this.ui.showToast('Playing notification alert chime preview.', 'medium');
  }

  getSoundLabel(soundId: string): string {
    const s = this.availableSounds.find(item => item.id === soundId);
    return s?.label || soundId;
  }

  getSoundDescription(soundId: string): string {
    const s = this.availableSounds.find(item => item.id === soundId);
    return s?.label || 'Operational sound alert';
  }

  onSoundProfileChange(profileKey: string, soundId: string): void {
    this.audio.setIncidentSound(profileKey, soundId);
    const profile = this.incidentSoundProfiles.find(p => p.key === profileKey);
    if (profile) {
      profile.soundId = soundId;
      this.audio.testSound(soundId);
      this.ui.showToast(`Updated alert chime for ${profile.label}.`, 'medium');
    }
  }

  previewSound(profileOrSoundId: IncidentSoundProfile | string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const soundId = typeof profileOrSoundId === 'string' ? profileOrSoundId : profileOrSoundId.soundId;
    const vol = typeof profileOrSoundId === 'object' && profileOrSoundId.volume !== undefined ? profileOrSoundId.volume / 100 : 1.0;
    this.audio.playSound(soundId, vol);
  }

  onIncidentVolumeChange(profile: IncidentSoundProfile, event: any): void {
    const val = typeof event?.detail?.value === 'number' ? event.detail.value : profile.volume;
    profile.volume = val;
    this.audio.setIncidentVolume(profile.key, val / 100);
  }

  resetIncidentVolume(profile: IncidentSoundProfile, event?: Event): void {
    if (event) event.stopPropagation();
    profile.volume = 100;
    this.audio.setIncidentVolume(profile.key, 1.0);
    this.ui.showToast(`Reset ${profile.label} volume to 100%.`, 'medium');
  }

  startRecordingKeybind(item: KeybindDef, event?: Event): void {
    if (event) event.stopPropagation();
    this.stopRecordingKeybind();
    this.recordingKeybindId = item.id;

    this.keyRecordingListener = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        this.stopRecordingKeybind();
        return;
      }

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      const combo = KeyboardShortcutsService.formatKeyEvent(e);
      if (combo) {
        const res = this.shortcuts.setKeybind(item.id, combo);
        if (res.success) {
          this.refreshKeybindList();
          this.ui.showToast(`Updated shortcut for ${item.label} to "${combo}".`, 'success');
        } else {
          this.ui.showToast(`Conflict: "${combo}" is already assigned to ${res.conflictWith?.label || 'another action'}.`, 'warning');
        }
        this.stopRecordingKeybind();
      }
    };

    window.addEventListener('keydown', this.keyRecordingListener, { capture: true });
  }

  stopRecordingKeybind(): void {
    if (this.keyRecordingListener) {
      window.removeEventListener('keydown', this.keyRecordingListener, { capture: true });
      this.keyRecordingListener = null;
    }
    this.recordingKeybindId = null;
  }

  resetIndividualKeybind(item: KeybindDef, event?: Event): void {
    if (event) event.stopPropagation();
    this.shortcuts.resetIndividualKeybind(item.id);
    this.refreshKeybindList();
    this.ui.showToast(`Reset ${item.label} to default shortcut.`, 'medium');
  }

  setSubPage(page: SettingsSubPage): void {
    if (this.exitTimer) {
      clearTimeout(this.exitTimer);
      this.exitTimer = null;
    }
    this.isExitingSubPage = false;
    this.activeSubPage = page;
    if (page !== 'main') {
      try {
        window.history.pushState({ sine_admin_subpage: page }, '');
      } catch {}
    }
  }

  goBackToSettings(triggerHistoryBack = true): void {
    if (this.activeSubPage === 'main') return;
    if (triggerHistoryBack && typeof window !== 'undefined' && window.history.state?.sine_admin_subpage) {
      window.history.back();
      return;
    }
    if (this.settings.getBool('reduce_animations')) {
      this.activeSubPage = 'main';
      this.isExitingSubPage = false;
      return;
    }
    this.isExitingSubPage = true;
    this.exitTimer = setTimeout(() => {
      this.activeSubPage = 'main';
      this.isExitingSubPage = false;
      this.exitTimer = null;
    }, 260);
  }

  refreshKeybindList(): void {
    this.keybindList = this.shortcuts.getKeybindList();
  }

  onKeybindChange(id: string, newKey: string): void {
    this.shortcuts.setKeybind(id, newKey);
    this.refreshKeybindList();
    this.ui.showToast(`Shortcut updated to Ctrl + ${newKey.toUpperCase()}.`, 'medium');
  }

  resetAllKeybinds(): void {
    this.shortcuts.resetKeybinds();
    this.refreshKeybindList();
    this.ui.showToast('Reset all keyboard shortcuts to system defaults.', 'medium');
  }

  constructor(
    private settings: UserSettingsService,
    private ui: AdminUiService,
    private api: ApiService,
    private desktopNotifications: DesktopNotificationsService,
    private audio: AudioService,
    private shortcuts: KeyboardShortcutsService,
    private router: Router,
    private elRef: ElementRef<HTMLElement>,
    private platform: Platform,
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
    this.mapDefaultStyle = (this.settings.get('map_default_style') as 'street' | 'satellite') || 'street';

    // Hydrate audio sound profiles
    this.incidentSoundProfiles.forEach(p => {
      p.soundId = this.audio.getIncidentSound(p.key);
      p.volume = Math.round(this.audio.getIncidentVolume(p.key) * 100);
    });

    this.refreshKeybindList();

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.popStateListener);
    }

    this.backButtonSub = this.platform.backButton.subscribeWithPriority(99999, (processNextHandler) => {
      if (this.activeSubPage !== 'main') {
        this.goBackToSettings(true);
      } else {
        processNextHandler();
      }
    });
  }

  private popStateListener = () => {
    if (this.activeSubPage !== 'main') {
      this.goBackToSettings(false);
    }
  };

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
      this.settings.toggleDarkMode(isChecked, undefined, originCoords || undefined);
    } else {
      this.settings.set(setting.key, String(isChecked));
      if (setting.key === 'notif_sound_effects') {
        this.audio.setMuted(!isChecked);
      }
    }
  }

  onMapStyleChange(style: 'street' | 'satellite'): void {
    this.mapDefaultStyle = style;
    this.settings.set('map_default_style', style);
    this.ui.showToast(`Default map layer set to ${style === 'street' ? 'Street' : 'Satellite'}.`, 'medium');
  }

  ngOnDestroy(): void {
    this.stopRecordingKeybind();
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.popStateListener);
    }
    if (this.backButtonSub) {
      this.backButtonSub.unsubscribe();
    }
    if (this.exitTimer) {
      clearTimeout(this.exitTimer);
      this.exitTimer = null;
    }
  }

  logout(): void {
    const performClientLogout = () => {
      localStorage.removeItem('api_token');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      this.desktopNotifications.stop();
      this.router.navigate(['/login']);
    };

    this.api.logout().pipe(
      timeout(3000),
      catchError(() => of(null))
    ).subscribe({
      next: () => performClientLogout(),
      error: () => performClientLogout()
    });
  }
}
