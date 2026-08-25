import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonToggle, IonListHeader, IonToast
} from '@ionic/angular/standalone';
import { UserSettingsService, SettingKey } from '../../../core/services/user-settings';
import { LocationService } from '../../../core/services/location';
import { TourService } from '../../../core/services/tour';
import { WidgetPinService } from '../../../core/services/widget-pin';
import { DialogService } from '../../../core/services/dialog.service';

interface SettingToggle { key: SettingKey; label: string; hint: (val: boolean) => string; value: boolean; }
interface SettingSelect { key: SettingKey; label: string; hint: string; value: string; options: { value: string; label: string }[]; }

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonToggle, IonListHeader, IonToast
  ]
})
export class SettingsPage implements OnInit {
  appearance: SettingToggle[] = [
    { key: 'dark_mode',          label: 'Dark Mode',           hint: v => v ? 'Dark theme is on.' : 'Light theme is on.',                                    value: false },
    { key: 'reduce_animations',  label: 'Reduce Animations',   hint: v => v ? 'Animations are reduced.' : 'Full animations are enabled.',                    value: false }
  ];
  location: SettingToggle[] = [
    { key: 'location_auto_fetch', label: 'Auto-fetch Location', hint: v => v ? 'Your location is tracked while the app is open.' : 'Location is only fetched when you tap "Use My Location".', value: true }
  ];
  mapSettings: SettingSelect[] = [
    { key: 'map_default_style', label: 'Default Map Style', hint: 'The map view used when you first open the report page.', value: 'street', options: [{ value: 'street', label: 'Street' }, { value: 'satellite', label: 'Satellite' }] }
  ];
  notifications: SettingToggle[] = [
    { key: 'notif_emergency_alerts', label: 'Emergency Dispatch Alerts', hint: v => v ? 'You\'ll be notified when MDRRMO dispatches a response.' : 'Emergency dispatch notifications are off.', value: true },
    { key: 'notif_broadcast_alerts', label: 'Broadcast Alerts',          hint: v => v ? 'You\'ll be notified when MDRRMO sends a public broadcast.' : 'Broadcast notifications are off.',          value: true }
  ];
  reporting: SettingToggle[] = [
    {
      key: 'photo_cropping_enabled',
      label: 'Photo Crop Editor',
      hint: v => v ? 'Crop editor opens after capturing a photo.' : 'Photos are attached directly to emergency reports without opening the crop editor.',
      value: true
    },
    {
      key: 'video_trimming_enabled',
      label: 'Video Trim Editor',
      hint: v => v ? 'Trim editor opens after recording a video.' : 'Videos are attached directly to emergency reports without opening the trim editor.',
      value: true
    },
    {
      key: 'save_media_to_device',
      label: 'Save Captured Media to Device',
      hint: v => v ? 'Photos and videos captured while reporting will be saved to your device gallery.' : 'Captured media is used only for the report and not saved to your device.',
      value: false
    }
  ];

  /**
   * Stage 3a — Home Screen Widget entry point. Android 8+ only (see
   * WidgetPinService/WidgetPinnerPlugin); the whole "Home Screen Widget"
   * ion-list is *ngIf'd out on iOS/web/older Android so this never shows a
   * button that can't do anything.
   */
  widgetAvailable = false;
  widgetToastOpen = false;
  widgetToastMessage = '';

  constructor(
    private settings: UserSettingsService,
    private locationSvc: LocationService,
    public tour: TourService,
    private widgetPin: WidgetPinService,
    private dialog: DialogService,
  ) {}

  ngOnInit() {
    this.appearance.forEach(s => s.value = this.settings.getBool(s.key));
    this.location.forEach(s => s.value = this.settings.getBool(s.key));
    this.notifications.forEach(s => s.value = this.settings.getBool(s.key));
    this.mapSettings.forEach(s => s.value = this.settings.get(s.key));
    this.reporting.forEach(s => s.value = this.settings.getBool(s.key));
    this.widgetPin.isAvailable().then(v => this.widgetAvailable = v);
  }

  onToggle(setting: SettingToggle) {
    this.settings.setBool(setting.key, setting.value);
    if (setting.key === 'dark_mode')         document.documentElement.classList.toggle('ion-palette-dark', setting.value);
    if (setting.key === 'reduce_animations') document.documentElement.classList.toggle('reduce-animations', setting.value);
    if (setting.key === 'location_auto_fetch') {
      if (setting.value) this.locationSvc.restart(); else this.locationSvc.stop();
    }
  }

  onSelect(setting: SettingSelect) { this.settings.set(setting.key, setting.value); }

  /**
   * Explains the "why" before asking Android to show its own pin-request
   * prompt — the widget only saves time if the user understands what it's
   * for, so we don't just say "Add to Home Screen" with no context.
   */
  async addWidget() {
    const confirmed = await this.dialog.confirm({
      title: 'Add Report Widget to Home Screen',
      message: 'In an emergency, every second counts. This puts a "Report Emergency" button right on your home screen, so you can start a report the moment something happens — no unlocking through the app, no digging for the right screen. Tap Add, then confirm the placement prompt Android shows you. You can remove it anytime like any other widget.',
      icon: 'fa-solid fa-table-cells-large',
      iconColor: 'danger',
      confirmLabel: 'Add Widget',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    const requested = await this.widgetPin.requestPin();
    this.widgetToastMessage = requested
      ? 'Confirm in the prompt that just appeared to finish adding the widget.'
      : "Couldn't open the widget prompt on this device.";
    this.widgetToastOpen = true;
  }
}
