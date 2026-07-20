import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonToggle,
  IonListHeader
} from '@ionic/angular/standalone';
import { UserSettingsService, SettingKey } from '../services/user-settings';
import { LocationService } from '../services/location';

interface SettingToggle {
  key: SettingKey;
  label: string;
  hint: (val: boolean) => string;
  value: boolean;
}

interface SettingSelect {
  key: SettingKey;
  label: string;
  hint: string;
  value: string;
  options: { value: string; label: string }[];
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonToggle,
    IonListHeader
  ]
})
export class SettingsPage implements OnInit {

  appearance: SettingToggle[] = [
    {
      key: 'dark_mode',
      label: 'Dark Mode',
      hint: v => v ? 'Dark theme is on.' : 'Light theme is on.',
      value: false
    },
    {
      key: 'reduce_animations',
      label: 'Reduce Animations',
      hint: v => v ? 'Animations are reduced — instant transitions.' : 'Full animations are enabled.',
      value: false
    }
  ];

  location: SettingToggle[] = [
    {
      key: 'location_auto_fetch',
      label: 'Auto-fetch Location',
      hint: v => v
        ? 'Your location is tracked while the app is open, so it\'s ready when you report.'
        : 'Location is only fetched when you tap "Use My Location" on the report page.',
      value: true
    }
  ];

  mapSettings: SettingSelect[] = [
    {
      key: 'map_default_style',
      label: 'Default Map Style',
      hint: 'The map view used when you first open the report page.',
      value: 'street',
      options: [
        { value: 'street', label: 'Street' },
        { value: 'satellite', label: 'Satellite' }
      ]
    }
  ];

  notifications: SettingToggle[] = [
    {
      key: 'notif_emergency_alerts',
      label: 'Emergency Dispatch Alerts',
      hint: v => v
        ? 'You\'ll be notified when MDRRMO dispatches a response to an emergency.'
        : 'Emergency dispatch notifications are off.',
      value: true
    },
    {
      key: 'notif_broadcast_alerts',
      label: 'Broadcast Alerts',
      hint: v => v
        ? 'You\'ll be notified when MDRRMO sends a public broadcast.'
        : 'Broadcast notifications are off.',
      value: true
    }
  ];

  constructor(
    private settings: UserSettingsService,
    private locationSvc: LocationService,
  ) {}

  ngOnInit() {
    this.appearance.forEach(s => s.value = this.settings.getBool(s.key));
    this.location.forEach(s => s.value = this.settings.getBool(s.key));
    this.notifications.forEach(s => s.value = this.settings.getBool(s.key));
    this.mapSettings.forEach(s => s.value = this.settings.get(s.key));
  }

  onToggle(setting: SettingToggle) {
    this.settings.setBool(setting.key, setting.value);
    if (setting.key === 'dark_mode') {
      document.documentElement.classList.toggle('ion-palette-dark', setting.value);
    }
    if (setting.key === 'reduce_animations') {
      document.documentElement.classList.toggle('reduce-animations', setting.value);
    }
    if (setting.key === 'location_auto_fetch') {
      if (setting.value) { this.locationSvc.restart(); }
      else               { this.locationSvc.stop(); }
    }
  }

  onSelect(setting: SettingSelect) {
    this.settings.set(setting.key, setting.value);
  }
}
