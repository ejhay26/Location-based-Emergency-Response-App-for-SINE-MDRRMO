import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';
import { IonContent, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  standalone: true,
  imports: [CommonModule, IonContent, IonButton]
})
export class WelcomePage implements OnInit {

  isFirstTime = false;
  currentSlide = 0;
  readonly TOTAL_SLIDES = 3;
  /** Backing array for the dot indicators; length must track TOTAL_SLIDES. */
  readonly slideIndices = Array.from({ length: this.TOTAL_SLIDES }, (_, i) => i);

  locationGranted  = false;
  cameraGranted    = false;
  photosGranted    = false;
  notifGranted     = false;
  locationRequested  = false;
  cameraRequested    = false;
  photosRequested    = false;
  notifRequested     = false;
  locationLoading = false;
  cameraLoading   = false;
  photosLoading   = false;
  notifLoading    = false;

  constructor(private router: Router) {}

  private withMinDelay<T>(promise: Promise<T>, ms = 600): Promise<T> {
    return Promise.all([promise, new Promise(r => setTimeout(r, ms))]).then(([result]) => result as T);
  }

  async ngOnInit() {
    if (!Capacitor.isNativePlatform()) {
      await this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    const seen = localStorage.getItem('welcomeSeen') === 'true';
    if (seen) {
      const user = localStorage.getItem('user');
      const role = localStorage.getItem('role');
      if (user && role) {
        const dest = (role === 'admin' || role === 'dispatcher') ? '/admin-dashboard' : '/tabs/home';
        await this.router.navigate([dest], { replaceUrl: true });
      } else {
        await this.router.navigate(['/login'], { replaceUrl: true });
      }
      return;
    }
    this.isFirstTime = true;
  }

  get isLastSlide(): boolean { return this.currentSlide === this.TOTAL_SLIDES - 1; }
  get isFirstSlide(): boolean { return this.currentSlide === 0; }
  next() { if (this.currentSlide < this.TOTAL_SLIDES - 1) this.currentSlide++; }
  prev() { if (this.currentSlide > 0) this.currentSlide--; }
  goToSlide(index: number) {
    if (index < 0 || index >= this.TOTAL_SLIDES) return;
    this.currentSlide = index;
  }

  // Permission requests all live on the same "All Permissions" slide now,
  // so granting one no longer auto-advances to the next slide — the user
  // moves on via the Next button once they're done with all three.
  async requestLocation() {
    this.locationLoading = true;
    try {
      const result = await this.withMinDelay(Geolocation.requestPermissions());
      this.locationGranted = result.location === 'granted' || result.coarseLocation === 'granted';
    } catch { this.locationGranted = false; }
    this.locationRequested = true;
    this.locationLoading = false;
  }

  async requestCamera() {
    this.cameraLoading = true;
    try {
      const result = await this.withMinDelay(Camera.requestPermissions({ permissions: ['camera'] }));
      this.cameraGranted = result.camera === 'granted';
    } catch { this.cameraGranted = false; }
    this.cameraRequested = true;
    this.cameraLoading = false;
  }

  async requestPhotos() {
    this.photosLoading = true;
    try {
      if (Capacitor.isNativePlatform()) {
        const check = await Camera.checkPermissions();
        if (check.photos === 'granted') {
          this.photosGranted = true;
        } else {
          try {
            const result = await this.withMinDelay(Camera.requestPermissions({ permissions: ['photos'] }));
            this.photosGranted = result.photos === 'granted' || result.photos === 'limited';
          } catch {
            this.photosGranted = true;
          }
        }
      } else {
        this.photosGranted = true;
      }
    } catch {
      this.photosGranted = true;
    }
    this.photosRequested = true;
    this.photosLoading = false;
  }

  async requestNotifications() {
    this.notifLoading = true;
    if (!Capacitor.isNativePlatform()) {
      await this.withMinDelay(Promise.resolve());
      this.notifGranted = false; this.notifRequested = true; this.notifLoading = false; return;
    }
    try {
      const result = await this.withMinDelay(PushNotifications.requestPermissions());
      this.notifGranted = result.receive === 'granted';
    } catch { this.notifGranted = false; }
    this.notifRequested = true;
    this.notifLoading = false;
  }

  goToLogin() { localStorage.setItem('welcomeSeen', 'true'); this.router.navigate(['/login']); }
  goToRegister() { localStorage.setItem('welcomeSeen', 'true'); this.router.navigate(['/register']); }
}
