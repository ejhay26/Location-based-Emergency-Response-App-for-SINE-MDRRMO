import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { IonRouterOutlet, NavController } from '@ionic/angular/standalone';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';
import { ImageCacheService } from '../../../core/services/image-cache';
import { UserSettingsService } from '../../../core/services/user-settings';
import { tabPushTransition } from '../../../core/animations/tab-push-transition';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, RouterModule, IonRouterOutlet, AppIconComponent],
  template: `
<div class="route-container">
  <ion-router-outlet [animated]="settings.shouldAnimate()" [animation]="tabAnimation"></ion-router-outlet>
</div>

<!-- Convx-Inspired Floating Liquid Glass Bottom Dock -->
<nav class="convx-dock-wrapper" [class.tour-tabs-blocked]="isTourBlockingTabs">
  <div class="convx-liquid-dock">
    <button *ngFor="let tab of tabs; let i = index"
            class="convx-dock-btn"
            [class.active]="activeIndex === i"
            [id]="'tour-tab-' + tab.id"
            [class.tour-highlight]="tour.targetId() === 'tour-tab-' + tab.id"
            (click)="navigate(tab, i)"
            [attr.aria-label]="tab.label">

      <!-- Active Liquid Glass Lens Pill (Convx Prismatic Rainbow Bubble) -->
      <div *ngIf="activeIndex === i" class="active-lens-bubble">
        <div class="active-lens-dispersion"></div>
      </div>

      <span *ngIf="tab.hasAvatar && profileAvatar" class="convx-dock-avatar"
            [class.active]="activeIndex === i"
            [style.background-image]="'url(' + profileAvatar + ')'"></span>
      <span *ngIf="!tab.hasAvatar || !profileAvatar" class="convx-dock-icon">
        <app-icon [name]="tab.icon" [size]="20" [color]="activeIndex === i ? '#ff3b30' : 'currentColor'"></app-icon>
      </span>
      <span class="convx-dock-label">{{ tab.label }}</span>
    </button>
  </div>
</nav>
  `,
  styles: [`
    .route-container { position: absolute; inset: 0; overflow: hidden; }

    /* Convx Floating Bottom Dock Container */
    .convx-dock-wrapper {
      position: fixed;
      bottom: calc(14px + env(safe-area-inset-bottom, 0px));
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      padding: 0 16px;
      z-index: 9999;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;

      &.tour-tabs-blocked {
        opacity: 0.6;
        pointer-events: none !important;
      }
    }

    .convx-liquid-dock {
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 440px;
      height: 64px;
      padding: 4px 6px;
      border-radius: 36px;
      box-sizing: border-box;

      /* Convx & Apple Liquid Glass Frosted Surface */
      background: rgba(18, 18, 22, 0.82);
      backdrop-filter: blur(32px) saturate(210%);
      -webkit-backdrop-filter: blur(32px) saturate(210%);
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.45),
                  inset 0 1px 1.5px rgba(255, 255, 255, 0.35),
                  inset 0 -1px 1px rgba(0, 0, 0, 0.25);

      :host-context(html:not(.ion-palette-dark)) &,
      :host-context(body:not(.dark)) & {
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.16),
                    inset 0 1px 1.5px rgba(255, 255, 255, 0.95);
      }
    }

    .convx-dock-btn {
      position: relative;
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      background: transparent;
      border: none;
      outline: none;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.70);
      padding: 0 4px;
      border-radius: 28px;
      transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                  transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
      -webkit-tap-highlight-color: transparent;

      :host-context(html:not(.ion-palette-dark)) &,
      :host-context(body:not(.dark)) & {
        color: rgba(60, 60, 67, 0.75);
      }

      &:active {
        transform: scale(0.92);
      }

      &.active {
        color: #ff3b30;
      }
    }

    /* Active Liquid Glass Lens Pill (Convx Prismatic Bubble) */
    .active-lens-bubble {
      position: absolute;
      inset: 4px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.14);
      pointer-events: none;
      z-index: 0;

      :host-context(html:not(.ion-palette-dark)) &,
      :host-context(body:not(.dark)) & {
        background: rgba(0, 0, 0, 0.06);
      }
    }

    /* Chromatic Aberration Dispersion Rim on Active Bubble (Convx) */
    .active-lens-dispersion {
      position: absolute;
      inset: -1px;
      border-radius: 25px;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.32),
        -1.5px -1.5px 5px rgba(255, 59, 48, 0.85),     /* Red-orange top dispersion */
        1.5px 1.5px 5px rgba(0, 210, 255, 0.85),       /* Cyan-blue bottom dispersion */
        0 0 12px rgba(255, 59, 48, 0.4),             /* Radiant red core glow */
        inset 0 1px 1.5px rgba(255, 255, 255, 0.6);
      mix-blend-mode: screen;
      pointer-events: none;
    }

    .convx-dock-icon {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .convx-dock-avatar {
      position: relative;
      z-index: 1;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      border: 2px solid rgba(255, 255, 255, 0.25);
      flex-shrink: 0;
      transition: border-color 0.2s;

      &.active {
        border-color: #ff3b30;
        box-shadow: 0 0 8px rgba(255, 59, 48, 0.6);
      }
    }

    .convx-dock-label {
      position: relative;
      z-index: 1;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.2px;
      line-height: 1;
      transition: font-weight 0.15s ease;

      .active & {
        font-weight: 800;
      }
    }
  `]
})
export class TabsPage implements OnInit, OnDestroy {
  get isTourBlockingTabs(): boolean {
    if (!this.tour.isActive()) return false;
    const target = this.tour.targetId();
    if (target && target.startsWith('tour-tab-')) return false;
    return true;
  }

  tabs = [
    { id: 'home',     route: '/tabs/home',     icon: 'home',             label: 'Home',     hasAvatar: false },
    { id: 'history',  route: '/tabs/history',  icon: 'history',          label: 'History',  hasAvatar: false },
    { id: 'profile',  route: '/tabs/profile',  icon: 'user',             label: 'Profile',  hasAvatar: true  },
    { id: 'settings', route: '/tabs/settings', icon: 'settings',         label: 'Settings', hasAvatar: false },
    { id: 'help',     route: '/tabs/help',     icon: 'circle-question',  label: 'Help',     hasAvatar: false },
  ];

  activeIndex = 0;
  profileAvatar = '';
  private routerSub!: Subscription;
  private storageListener = () => this.refreshAvatar();

  /** Ionic-native replacement for the old Motion+clone push transition — see tab-push-transition.ts. */
  tabAnimation = tabPushTransition;

  constructor(
    private router: Router,
    private navCtrl: NavController,
    private api: ApiService,
    public tour: TourService,
    private imageCache: ImageCacheService,
    public settings: UserSettingsService,
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
      const cached = this.imageCache.getCached(path);
      if (cached) { this.profileAvatar = cached; return; }
      this.profileAvatar = await this.imageCache.resolve(path);
    } catch { this.profileAvatar = ''; }
  }

  /**
   * Direction is what tells tabPushTransition (and ion-router-outlet's own
   * stack bookkeeping) which side to slide from — NavController.navigateForward
   * / .navigateBack are what actually set that, unlike a plain
   * router.navigate() call which leaves it unset. `cameFromIndex` has to be
   * read from the CURRENT url before activeIndex is reassigned below, since
   * that reassignment is what drives the tab bar's active-state styling
   * (icon ring, red color, bold label).
   */
  async navigate(tab: { route: string; id: string }, index: number) {
    const cameFromIndex = this.tabs.findIndex(t => this.router.url.includes('/' + t.id));
    if (this.tour.isActive() && this.tour.targetId() === 'tour-tab-' + tab.id) {
      this.tour.onInteraction();
    }
    const navPromise = (index >= cameFromIndex)
      ? this.navCtrl.navigateForward([tab.route])
      : this.navCtrl.navigateBack([tab.route]);
    const success = await navPromise;
    if (success) {
      this.activeIndex = index;
    }
  }
}
