import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ApiService } from '../services/api';
import { TourService } from '../services/tour';
import { ImageCacheService } from '../services/image-cache';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
<router-outlet></router-outlet>

<!-- Custom floating pill tab bar -->
<nav class="ctab-bar">

  <div class="ctab-indicator"
       [style.left]="'calc(' + (activeIndex * 20) + '% + 4px)'">
  </div>

  <button *ngFor="let tab of tabs; let i = index"
          class="ctab-btn"
          [class.active]="activeIndex === i"
          [id]="'tour-tab-' + tab.id"
          [class.tour-highlight]="tour.targetId() === 'tour-tab-' + tab.id"
          (click)="navigate(tab, i)"
          [attr.aria-label]="tab.label">

    <span *ngIf="tab.hasAvatar && profileAvatar"
          class="ctab-avatar"
          [class.active]="activeIndex === i"
          [style.background-image]="'url(' + profileAvatar + ')'">
    </span>
    <i *ngIf="!tab.hasAvatar || !profileAvatar" [class]="tab.icon"></i>
    <span class="ctab-label">{{ tab.label }}</span>
  </button>

</nav>
  `,
  styles: [`
    :host {
      display: block;
      padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px));
    }
    .ctab-bar {
      position: fixed;
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      left: 16px;
      right: 16px;
      height: 60px;
      background: var(--ion-color-danger);
      border-radius: 30px;
      display: flex;
      align-items: center;
      z-index: 9000;
      box-shadow: 0 6px 28px rgba(235, 68, 90, 0.45);
      user-select: none;
      -webkit-user-select: none;
    }
    .ctab-indicator {
      position: absolute;
      top: 5px;
      height: 50px;
      width: calc(20% - 8px);
      background: rgba(255, 255, 255, 0.22);
      border-radius: 25px;
      transition: left 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }
    .ctab-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      height: 100%;
      padding: 0;
      transition: color 0.2s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .ctab-btn.active { color: white; }
    .ctab-btn i { font-size: 19px; }
    .ctab-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.3px;
      line-height: 1;
    }
    .ctab-avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      border: 2px solid rgba(255, 255, 255, 0.45);
      flex-shrink: 0;
      transition: border-color 0.2s;
    }
    .ctab-avatar.active { border-color: white; }
  `]
})
export class TabsPage implements OnInit, OnDestroy {

  tabs = [
    { id: 'home',     route: '/tabs/home',     icon: 'fa-solid fa-house',             label: 'Home',     hasAvatar: false },
    { id: 'status',   route: '/tabs/status',   icon: 'fa-solid fa-clock-rotate-left', label: 'Status',   hasAvatar: false },
    { id: 'profile',  route: '/tabs/profile',  icon: 'fa-solid fa-circle-user',       label: 'Profile',  hasAvatar: true  },
    { id: 'settings', route: '/tabs/settings', icon: 'fa-solid fa-sliders',           label: 'Settings', hasAvatar: false },
    { id: 'help',     route: '/tabs/help',     icon: 'fa-solid fa-circle-question',   label: 'Help',     hasAvatar: false },
  ];

  activeIndex = 0;
  profileAvatar = '';

  private routerSub!: Subscription;
  private storageListener = () => this.refreshAvatar();

  constructor(
    private router: Router,
    private api: ApiService,
    public tour: TourService,
    private imageCache: ImageCacheService,
  ) {}

  ngOnInit() {
    this.refreshAvatar();
    window.addEventListener('storage', this.storageListener);
    this.syncActiveTab(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => this.syncActiveTab(e.urlAfterRedirects));
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
    window.removeEventListener('storage', this.storageListener);
  }

  private syncActiveTab(url: string) {
    const idx = this.tabs.findIndex(t => url.includes('/' + t.id));
    if (idx >= 0) this.activeIndex = idx;
  }

  async refreshAvatar() {
    const userStr = localStorage.getItem('user');
    if (!userStr) { this.profileAvatar = ''; return; }
    try {
      const user = JSON.parse(userStr);
      const path = user?.profile_picture;
      if (!path) { this.profileAvatar = ''; return; }
      // Check cache first for instant render, then fetch in background.
      const cached = this.imageCache.getCached(path);
      if (cached) { this.profileAvatar = cached; return; }
      this.profileAvatar = await this.imageCache.resolve(path);
    } catch {
      this.profileAvatar = '';
    }
  }

  navigate(tab: { route: string; id: string }, index: number) {
    this.activeIndex = index;
    if (this.tour.isActive() && this.tour.targetId() === 'tour-tab-' + tab.id) {
      this.tour.onInteraction();
    }
    this.router.navigate([tab.route]);
  }
}
