import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { MenuController, AlertController } from '@ionic/angular';
import {
  IonApp, IonMenu, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonMenuToggle, IonButton, IonContent, IonList, IonItem, IonLabel,
  IonToggle, IonFooter, IonRouterOutlet
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [
    CommonModule, RouterModule,
    IonApp, IonMenu, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonMenuToggle, IonButton, IonContent, IonList, IonItem, IonLabel,
    IonToggle, IonFooter, IonRouterOutlet
  ],
})
export class AppComponent implements OnInit {

  userFullName = '';
  userRole = '';
  userAvatar = '';
  isDarkMode = false;
  currentUrl = '/login';
  private toggleReady = false;

  constructor(
    private router: Router,
    private menuCtrl: MenuController,
    private alertCtrl: AlertController   // replaces window.confirm — avoids Electron focus bug
  ) {
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) this.currentUrl = e.urlAfterRedirects;
    });
  }

  ngOnInit() {
    const stored = localStorage.getItem('darkMode') === 'true';
    this.isDarkMode = stored;
    this.applyDarkMode(stored);
    setTimeout(() => { this.toggleReady = true; }, 300);
    this.refreshUserInfo();
    window.addEventListener('storage', () => this.refreshUserInfo());
  }

  refreshUserInfo() {
    const userStr = localStorage.getItem('user');
    if (!userStr) { this.userFullName = ''; this.userAvatar = ''; this.userRole = ''; return; }
    try {
      const user = JSON.parse(userStr);
      this.userFullName = `${user.first_name} ${user.last_name}`;
      const pic = user.profile_picture || '';
      this.userAvatar = pic.includes('ionicframework.com') ? '' : pic;
      const role = localStorage.getItem('role') || '';
      this.userRole = role === 'admin' ? 'Master Admin' : role === 'dispatcher' ? 'Dispatcher' : 'Citizen';
    } catch { /* corrupted */ }
  }

  menuOpened() { this.refreshUserInfo(); }

  applyDarkMode(dark: boolean) {
    document.documentElement.classList.toggle('ion-palette-dark', dark);
  }

  toggleDarkMode(event: any) {
    if (!this.toggleReady) return;
    const dark: boolean = event.detail.checked;
    this.isDarkMode = dark;
    this.applyDarkMode(dark);
    localStorage.setItem('darkMode', String(dark));
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
          role: 'destructive',
          handler: () => {
            // Clear dark mode so next user starts fresh
            this.isDarkMode = false;
            this.applyDarkMode(false);
            localStorage.removeItem('darkMode');
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            this.menuCtrl.close();
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    await alert.present();
  }
}