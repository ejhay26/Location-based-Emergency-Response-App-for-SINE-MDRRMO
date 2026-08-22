import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonToast, IonToggle } from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { UserSettingsService, SettingKey } from '../../../core/services/user-settings';
import { LocationService } from '../../../core/services/location';
import { TourService } from '../../../core/services/tour';
import { WidgetPinService } from '../../../core/services/widget-pin';
import { ProfilePhotoComponent } from '../../citizen/profile/components/profile-photo/profile-photo.component';
import { ProfileMedicalComponent, MedicalData } from '../../citizen/profile/components/profile-medical/profile-medical.component';
import { ToastRequest } from '../../citizen/profile/components/profile-shared-types';

interface SetupToggle { key: SettingKey; label: string; hint: (val: boolean) => string; value: boolean; }

/** Shared with home.page.ts — must stay in sync so the two entry points never both nag the same account. */
const WIDGET_PROMPT_DISMISSED_KEY = 'widget_prompt_dismissed';

/**
 * AccountSetupPage — first-login-only onboarding flow (profile photo,
 * quick settings, medical profile, widget offer, tour offer). Reuses the
 * welcome page's slide/swipe container pattern and the SAME underlying
 * save logic as the Profile/Settings pages (ProfilePhotoComponent,
 * ProfileMedicalComponent, UserSettingsService) rather than duplicating
 * any of it — this page is only a themed, segmented shell around
 * functionality that already exists.
 *
 * "Seen" state is persisted server-side via ApiService.completeAccountSetup
 * (users.setup_completed), NOT device localStorage, so it survives
 * reinstalls / new devices and only ever fires once per account.
 */
@Component({
  selector: 'app-account-setup',
  templateUrl: './account-setup.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonToast, IonToggle,
    ProfilePhotoComponent, ProfileMedicalComponent,
  ],
})
export class AccountSetupPage implements OnInit {

  currentSlide = 0;

  /**
   * Stage 3a — the widget-offer slide only exists on Android 8+ with a
   * pin-capable launcher (see WidgetPinService). TOTAL_SLIDES/slideIndices
   * are getters (not fixed fields) because widgetAvailable resolves
   * asynchronously in ngOnInit — the slide count, dot indicators, and
   * container sizing in the template all read from these so they can
   * never drift out of sync with each other.
   */
  private readonly BASE_SLIDES = 4;
  widgetAvailable = false;
  get TOTAL_SLIDES(): number { return this.BASE_SLIDES + (this.widgetAvailable ? 1 : 0); }
  get slideIndices(): number[] { return Array.from({ length: this.TOTAL_SLIDES }, (_, i) => i); }

  userData: any = {};
  medicalData: MedicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  // Full parity with the Settings page's toggle-type settings (Stage 5 —
  // previously a curated 3-toggle subset; now mirrors Settings exactly so
  // nothing a citizen sets here surprises them later). The one Settings-page
  // control NOT mirrored is map_default_style, since that's a dropdown
  // rather than a toggle and doesn't fit this row style — it stays
  // Settings-page-only.
  appearance: SetupToggle[] = [
    { key: 'dark_mode',         label: 'Dark Mode',          hint: v => v ? 'Dark theme is on.' : 'Light theme is on.',                     value: false },
    { key: 'reduce_animations', label: 'Reduce Animations',  hint: v => v ? 'Animations are reduced.' : 'Full animations are enabled.',      value: false },
  ];
  location: SetupToggle[] = [
    { key: 'location_auto_fetch', label: 'Auto-fetch Location', hint: v => v ? 'Your location is tracked while the app is open.' : 'Location is only fetched when you tap "Use My Location".', value: true },
  ];
  notifications: SetupToggle[] = [
    { key: 'notif_emergency_alerts', label: 'Emergency Dispatch Alerts', hint: v => v ? "You'll be notified when MDRRMO dispatches a response." : 'Emergency dispatch notifications are off.', value: true },
    { key: 'notif_broadcast_alerts', label: 'Broadcast Alerts',          hint: v => v ? "You'll be notified when MDRRMO sends a public broadcast." : 'Broadcast notifications are off.',          value: true },
  ];
  reporting: SetupToggle[] = [
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
    },
  ];

  isFinishing = false;
  toastOpen    = false;
  toastMessage = '';
  toastColor   = 'success';

  constructor(
    private router: Router,
    private api: ApiService,
    public settings: UserSettingsService,
    private locationSvc: LocationService,
    public tour: TourService,
    private widgetPin: WidgetPinService,
  ) {}

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (!userStr) { this.router.navigate(['/login'], { replaceUrl: true }); return; }
    try { this.userData = JSON.parse(userStr); }
    catch { localStorage.removeItem('user'); this.router.navigate(['/login'], { replaceUrl: true }); return; }
    if (!this.userData?.user_id) { this.router.navigate(['/login'], { replaceUrl: true }); return; }

    this.medicalData = {
      blood_type:         this.userData.blood_type         || '',
      allergies:          this.userData.allergies          || '',
      medical_conditions: this.userData.medical_conditions || '',
      pwd_status:          this.userData.pwd_status          || '',
    };
    this.appearance.forEach(s => s.value = this.settings.getBool(s.key));
    this.location.forEach(s => s.value = this.settings.getBool(s.key));
    this.notifications.forEach(s => s.value = this.settings.getBool(s.key));
    this.reporting.forEach(s => s.value = this.settings.getBool(s.key));

    // Fired early and in parallel with the rest of ngOnInit — resolves in a
    // few ms (a local SDK-version + launcher-capability check, no network),
    // well before a user reading through slides 1-3 reaches slide 4.
    this.widgetPin.isAvailable().then(v => this.widgetAvailable = v);
  }

  get isLastSlide(): boolean { return this.currentSlide === this.TOTAL_SLIDES - 1; }
  get isFirstSlide(): boolean { return this.currentSlide === 0; }
  next() { if (this.currentSlide < this.TOTAL_SLIDES - 1) this.currentSlide++; }
  prev() { if (this.currentSlide > 0) this.currentSlide--; }
  goToSlide(index: number) {
    if (index < 0 || index >= this.TOTAL_SLIDES) return;
    this.currentSlide = index;
  }

  onToggle(setting: SetupToggle) {
    this.settings.setBool(setting.key, setting.value);
    if (setting.key === 'dark_mode')         document.documentElement.classList.toggle('ion-palette-dark', setting.value);
    if (setting.key === 'reduce_animations') document.documentElement.classList.toggle('reduce-animations', setting.value);
    if (setting.key === 'location_auto_fetch') {
      if (setting.value) this.locationSvc.restart(); else this.locationSvc.stop();
    }
  }

  onUserUpdated(user: any) {
    this.userData = user;
    localStorage.setItem('user', JSON.stringify(user));
  }

  onToast(req: ToastRequest) {
    this.toastMessage = req.msg; this.toastColor = req.color; this.toastOpen = false;
    setTimeout(() => { this.toastOpen = true; }, 10);
  }

  /** Fires the native pin prompt, then advances regardless of outcome — the system prompt itself is the user's real confirmation step, not this slide. */
  async addWidgetNow() {
    await this.widgetPin.requestPin();
    this.next();
  }

  private finishSetup(startTour: boolean) {
    if (this.isFinishing) return;
    this.isFinishing = true;

    // Whether they added the widget or tapped "Skip for now", they've been
    // offered it here — set the same flag Home's banner checks so a brand
    // new account never gets asked a second time right after onboarding.
    // (The Settings page item stays available forever regardless.)
    if (this.widgetAvailable) localStorage.setItem(WIDGET_PROMPT_DISMISSED_KEY, '1');
    const proceed = () => {
      this.isFinishing = false;
      if (startTour) {
        this.router.navigate(['/tabs/home']).then(() => this.tour.start('all'));
      } else {
        this.tour.markSeen();
        this.router.navigate(['/tabs/home']);
      }
    };
    this.api.completeAccountSetup(this.userData.user_id).subscribe({
      next: (res: any) => {
        if (res?.user) { this.userData = res.user; localStorage.setItem('user', JSON.stringify(res.user)); }
        proceed();
      },
      // Even if persisting the flag failed (e.g. a transient network blip),
      // don't trap the user on the setup screen — let them into the app.
      // Worst case they see this flow once more on their next login.
      error: () => proceed(),
    });
  }

  startTourNow() { this.finishSetup(true); }
  skipTour()     { this.finishSetup(false); }
}
