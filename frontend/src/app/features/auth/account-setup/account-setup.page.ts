import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonButton, IonToast, IonToggle } from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { UserSettingsService, SettingKey } from '../../../core/services/user-settings';
import { TourService } from '../../../core/services/tour';
import { ProfilePhotoComponent } from '../../citizen/profile/components/profile-photo/profile-photo.component';
import { ProfileMedicalComponent, MedicalData } from '../../citizen/profile/components/profile-medical/profile-medical.component';
import { ToastRequest } from '../../citizen/profile/components/profile-shared-types';

interface SetupToggle { key: SettingKey; label: string; hint: (val: boolean) => string; value: boolean; }

/**
 * AccountSetupPage — first-login-only onboarding flow (profile photo,
 * quick settings, medical profile, tour offer). Reuses the welcome page's
 * slide/swipe container pattern and the SAME underlying save logic as the
 * Profile/Settings pages (ProfilePhotoComponent, ProfileMedicalComponent,
 * UserSettingsService) rather than duplicating any of it — this page is
 * only a themed, segmented shell around functionality that already exists.
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
  readonly TOTAL_SLIDES = 4;
  /** Backing array for the dot indicators; length must track TOTAL_SLIDES. */
  readonly slideIndices = Array.from({ length: this.TOTAL_SLIDES }, (_, i) => i);

  userData: any = {};
  medicalData: MedicalData = { blood_type: '', allergies: '', medical_conditions: '', pwd_status: '' };

  // Curated subset for a quick onboarding pass — Map/Location and Reporting
  // settings stay on the full Settings page rather than crowding this flow.
  appearance: SetupToggle[] = [
    { key: 'dark_mode', label: 'Dark Mode', hint: v => v ? 'Dark theme is on.' : 'Light theme is on.', value: false },
  ];
  notifications: SetupToggle[] = [
    { key: 'notif_emergency_alerts', label: 'Emergency Dispatch Alerts', hint: v => v ? "You'll be notified when MDRRMO dispatches a response." : 'Emergency dispatch notifications are off.', value: true },
    { key: 'notif_broadcast_alerts', label: 'Broadcast Alerts',          hint: v => v ? "You'll be notified when MDRRMO sends a public broadcast." : 'Broadcast notifications are off.',          value: true },
  ];

  isFinishing = false;
  toastOpen    = false;
  toastMessage = '';
  toastColor   = 'success';

  constructor(
    private router: Router,
    private api: ApiService,
    public settings: UserSettingsService,
    public tour: TourService,
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
    this.notifications.forEach(s => s.value = this.settings.getBool(s.key));
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
    if (setting.key === 'dark_mode') {
      document.documentElement.classList.toggle('ion-palette-dark', setting.value);
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

  private finishSetup(startTour: boolean) {
    if (this.isFinishing) return;
    this.isFinishing = true;
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
