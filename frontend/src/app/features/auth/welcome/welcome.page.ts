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
  readonly TOTAL_SLIDES = 5;

  locationGranted  = false;
  cameraGranted    = false;
  notifGranted     = false;
  locationRequested  = false;
  cameraRequested    = false;
  notifRequested     = false;
  locationLoading = false;
  cameraLoading   = false;
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
  goToSlide(index: number) { this.currentSlide = index; }

  async requestLocation() {
    this.locationLoading = true;
    try {
      const result = await this.withMinDelay(Geolocation.requestPermissions());
      this.locationGranted = result.location === 'granted' || result.coarseLocation === 'granted';
    } catch { this.locationGranted = false; }
    this.locationRequested = true;
    this.locationLoading = false;
    if (this.locationGranted) setTimeout(() => this.next(), 800);
  }

  async requestCamera() {
    this.cameraLoading = true;
    try {
      const result = await this.withMinDelay(Camera.requestPermissions({ permissions: ['camera', 'photos'] }));
      this.cameraGranted = result.camera === 'granted' || result.photos === 'granted';
    } catch { this.cameraGranted = false; }
    this.cameraRequested = true;
    this.cameraLoading = false;
    if (this.cameraGranted) setTimeout(() => this.next(), 800);
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
    if (this.notifGranted) setTimeout(() => this.next(), 800);
  }

  goToLogin() { localStorage.setItem('welcomeSeen', 'true'); this.router.navigate(['/login']); }
  goToRegister() { localStorage.setItem('welcomeSeen', 'true'); this.router.navigate(['/register']); }
}
