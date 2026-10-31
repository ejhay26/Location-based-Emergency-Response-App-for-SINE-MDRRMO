import { Component, OnInit, OnDestroy, ElementRef, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonItem, IonLabel, IonToggle, IonToast, IonRange,
  IonButtons, IonButton, Platform
} from '@ionic/angular/standalone';
import { UserSettingsService, SettingKey } from '../../../core/services/user-settings';
import { LocationService } from '../../../core/services/location';
import { TourService } from '../../../core/services/tour';
import { WidgetPinService } from '../../../core/services/widget-pin';
import { DialogService } from '../../../core/services/dialog.service';
import { AudioService } from '../../../core/services/audio.service';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

export type CitizenSettingsSubPage = 'main' | 'appearance' | 'audio' | 'map' | 'notifications' | 'reporting' | 'widgets';

interface SettingToggle { key: SettingKey; label: string; hint: (val: boolean) => string; value: boolean; icon?: string; }
interface SettingSelect { key: SettingKey; label: string; hint: string; value: string; options: { value: string; label: string }[]; }

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonItem, IonLabel, IonToggle, IonToast, IonRange,
    IonButtons, IonButton,
    AppIconComponent
  ]
})
export class SettingsPage implements OnInit, OnDestroy {
  audio = inject(AudioService);
  platform = inject(Platform);

  activeSubPage: CitizenSettingsSubPage = 'main';
  isExitingSubPage = false;
  private exitTimer: any = null;
  private backButtonSub?: Subscription;

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
    this.audio.setVolume(0.8);
  }

  testAudioSound(): void {
    this.audio.testChime();
  }

  setSubPage(page: CitizenSettingsSubPage): void {
    if (this.exitTimer) {
      clearTimeout(this.exitTimer);
      this.exitTimer = null;
    }
    this.isExitingSubPage = false;
    this.activeSubPage = page;
    if (page !== 'main') {
      try {
        window.history.pushState({ sine_citizen_subpage: page }, '');
      } catch {}
    }
  }

  goBackToSettings(triggerHistoryBack = true): void {
    if (this.activeSubPage === 'main') return;
    if (triggerHistoryBack && typeof window !== 'undefined' && window.history.state?.sine_citizen_subpage) {
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

  getSubPageTitle(): string {
    switch (this.activeSubPage) {
      case 'appearance': return 'Appearance & Theme';
      case 'audio': return 'Audio & Alert Chimes';
      case 'map': return 'Map & Location';
      case 'notifications': return 'Notifications & Alerts';
      case 'reporting': return 'Reporting Media';
      case 'widgets': return 'Home Screen Widgets';
      default: return 'Settings';
    }
  }

  get mapDefaultStyle(): 'street' | 'satellite' {
    return (this.settings.get('map_default_style') as 'street' | 'satellite') || 'street';
  }

  onMapStyleChange(style: 'street' | 'satellite'): void {
    this.settings.set('map_default_style', style);
    this.mapSettings.forEach(s => s.value = style);
  }

  appearance: SettingToggle[] = [
    { key: 'dark_mode',          label: 'Dark Mode',           hint: v => v ? 'Dark theme is active across the application.' : 'Light theme is active.',                    value: false, icon: 'moon' },
    { key: 'reduce_animations',  label: 'Reduce Animations',   hint: v => v ? 'Interface animations are minimized.' : 'Full interface animations are active.',              value: false, icon: 'sliders' }
  ];
  location: SettingToggle[] = [
    { key: 'location_auto_fetch', label: 'Auto-fetch GPS Location', hint: v => v ? 'Your location is tracked automatically while the app is active.' : 'Location is only fetched when you tap "Use My Location".', value: true, icon: 'location-dot' }
  ];
  mapSettings: SettingSelect[] = [
    { key: 'map_default_style', label: 'Default Map Style', hint: 'The map view used when you first open the report page.', value: 'street', options: [{ value: 'street', label: 'Street' }, { value: 'satellite', label: 'Satellite' }] }
  ];
  notifications: SettingToggle[] = [
    { key: 'notif_emergency_alerts', label: 'Emergency Dispatch Alerts', hint: v => v ? 'Receive instant alerts when MDRRMO dispatches emergency units.' : 'Emergency dispatch notifications are muted.', value: true, icon: 'bell' },
    { key: 'notif_broadcast_alerts', label: 'Public Broadcast Alerts',   hint: v => v ? 'Receive official disaster warnings and weather bulletins from MDRRMO.' : 'Broadcast notifications are muted.', value: true, icon: 'bullhorn' }
  ];
  reporting: SettingToggle[] = [
    {
      key: 'photo_cropping_enabled',
      label: 'Photo Crop Editor',
      hint: v => v ? 'Crop editor opens after capturing a photo to frame key proof.' : 'Photos are attached directly to emergency reports without opening the crop editor.',
      value: true,
      icon: 'crop-simple'
    },
    {
      key: 'video_trimming_enabled',
      label: 'Video Trim Editor',
      hint: v => v ? 'Trim editor opens after recording a video to keep only crucial footage.' : 'Videos are attached directly to emergency reports without opening the trim editor.',
      value: true,
      icon: 'camera-rotate'
    },
    {
      key: 'save_media_to_device',
      label: 'Save Captured Media to Gallery',
      hint: v => v ? 'Photos and videos captured while reporting will be saved to your device gallery.' : 'Captured media is used only for the report and not saved to your device gallery.',
      value: false,
      icon: 'images'
    }
  ];

  widgetAvailable = false;
  widgetToastOpen = false;
  widgetToastMessage = '';

  constructor(
    private settings: UserSettingsService,
    private locationSvc: LocationService,
    public tour: TourService,
    private widgetPin: WidgetPinService,
    private dialog: DialogService,
    private elRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit() {
    this.syncSettings();
    this.widgetPin.isAvailable().then(v => this.widgetAvailable = v);

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

  ngOnDestroy() {
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

  ionViewWillEnter() {
    this.syncSettings();
  }

  private syncSettings(): void {
    this.appearance.forEach(s => s.value = this.settings.getBool(s.key));
    this.location.forEach(s => s.value = this.settings.getBool(s.key));
    this.notifications.forEach(s => s.value = this.settings.getBool(s.key));
    this.mapSettings.forEach(s => s.value = this.settings.get(s.key));
    this.reporting.forEach(s => s.value = this.settings.getBool(s.key));
  }

  private lastToggleOrigin: { x: number; y: number } | null = null;

  onTogglePointer(e: any): void {
    const clientX = e?.clientX ?? e?.touches?.[0]?.clientX ?? e?.changedTouches?.[0]?.clientX;
    const clientY = e?.clientY ?? e?.touches?.[0]?.clientY ?? e?.changedTouches?.[0]?.clientY;
    if (typeof clientX === 'number' && typeof clientY === 'number' && clientX > 0 && clientY > 0) {
      this.lastToggleOrigin = { x: Math.round(clientX), y: Math.round(clientY) };
    }
  }

  onToggle(setting: SettingToggle, event?: any) {
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
      if (setting.key === 'reduce_animations') document.documentElement.classList.toggle('reduce-animations', isChecked);
      if (setting.key === 'location_auto_fetch') {
        if (isChecked) this.locationSvc.restart(); else this.locationSvc.stop();
      }
    }
  }

  async addWidget(type: 'emergency' | 'hazard' = 'emergency') {
    const isEmergency = type === 'emergency';
    const confirmed = await this.dialog.confirm({
      title: isEmergency ? 'Add Emergency SOS Widget' : 'Add Report Hazard Widget',
      message: isEmergency
        ? 'In an emergency, every second counts. This puts a "Report Emergency" button right on your home screen, so you can start a report the moment something happens — no unlocking through the app, no digging for the right screen. Tap Add, then confirm the placement prompt Android shows you.'
        : 'Report road blockages, fallen electrical posts, flooding, or public safety hazards directly from your home screen. Tap Add, then confirm the placement prompt Android shows you.',
      icon: isEmergency ? 'alert' : 'hazard',
      iconColor: isEmergency ? 'danger' : 'warning',
      confirmLabel: 'Add Widget',
      confirmColor: isEmergency ? 'danger' : 'warning',
    });
    if (!confirmed) return;

    const requested = await this.widgetPin.requestPin(type);
    this.widgetToastMessage = requested
      ? 'Confirm in the prompt that just appeared to finish adding the widget.'
      : "Couldn't open the widget prompt on this device.";
    this.widgetToastOpen = true;
  }
}
