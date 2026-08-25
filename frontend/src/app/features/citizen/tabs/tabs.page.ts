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

<nav class="ctab-bar">
  <button *ngFor="let tab of tabs; let i = index"
          class="ctab-btn" [class.active]="activeIndex === i"
          [id]="'tour-tab-' + tab.id"
          [class.tour-highlight]="tour.targetId() === 'tour-tab-' + tab.id"
          (click)="navigate(tab, i)" [attr.aria-label]="tab.label">
    <span *ngIf="tab.hasAvatar && profileAvatar" class="ctab-avatar"
          [class.active]="activeIndex === i"
          [style.background-image]="'url(' + profileAvatar + ')'"></span>
    <span *ngIf="!tab.hasAvatar || !profileAvatar" class="ctab-icon-ring">
      <app-icon [name]="tab.icon" [size]="20" [color]="activeIndex === i ? 'var(--ion-color-danger, #d32f2f)' : 'var(--ion-color-medium, #8a8a8e)'"></app-icon>
    </span>
    <span class="ctab-label">{{ tab.label }}</span>
  </button>
</nav>
  `,
  styles: [`
    /* .route-container just needs to size/clip the nested outlet — the
       former '> * { position:absolute; inset:0; ... }' hand-rolled ion-page
       replication is gone. A real <ion-router-outlet> stamps the genuine
       'ion-page' class onto each routed page itself, the same way the ROOT
       ion-router-outlet already does for this whole TabsPage, so ion-content
       sizing works correctly without reproducing that CSS by hand anymore. */
    .route-container { position: absolute; inset: 0; overflow: hidden; }
    .ctab-bar {
      /* Flush full-width bar: sits exactly at the screen edge (bottom:0,
         left/right:0) instead of floating with side margins, square top
         corners (no border-radius). Depth comes from an upward-cast
         box-shadow (negative y-offset) plus a thin top border — together
         these are what make the bar read as sitting ABOVE page content
         instead of blending into it, since a flush bar has no side/bottom
         edges of its own to imply elevation the way the old floating pill
         version did via its all-around shadow. Safe-area inset is baked
         into the bar's own height via padding-bottom rather than a gap
         above it, so the touchable 60px row stays centered above the
         home-indicator area on notched devices instead of being pushed
         off-bounds. */
      position: fixed; bottom: 0; left: 0; right: 0;
      height: calc(60px + env(safe-area-inset-bottom, 0px));
      padding-bottom: env(safe-area-inset-bottom, 0px);
      /* Adaptive surface color — white in light mode, the palette's dark
         card color in dark mode — rather than a literal 'white', since this
         app toggles dark mode via the 'ion-palette-dark' class (see
         global.scss's dark.class.css import), which is what makes
         --ion-card-background flip automatically instead of staying stuck
         white after a dark-mode toggle. Red moves to an accent role (the
         active icon ring/color, not the bar's own background). */
      background: var(--ion-card-background, #ffffff);
      border-top: 1px solid var(--ion-color-step-150, rgba(0, 0, 0, 0.08));
      border-radius: 0;
      display: flex; align-items: center; z-index: 9000;
      box-shadow: 0 -6px 16px rgba(0, 0, 0, 0.12), 0 -1px 4px rgba(0, 0, 0, 0.08);
      user-select: none; -webkit-user-select: none;
    }
    .ctab-btn {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 3px; background: transparent; border: none;
      color: var(--ion-color-medium, #8a8a8e); cursor: pointer; height: 100%; padding: 0;
      transition: color 0.2s ease; -webkit-tap-highlight-color: transparent;
    }
    .ctab-btn.active { color: var(--ion-color-danger, #d32f2f); }
    .ctab-label {
      font-size: 10px; font-weight: 600; letter-spacing: 0.3px; line-height: 1;
      transition: font-weight 0.15s ease;
    }
    .ctab-btn.active .ctab-label { font-weight: 800; }
    /* Plain centering container now — no border/ring here anymore. Only
       the avatar (below) keeps a circular outline; the other four tabs
       outline their own icon shape directly (see '.ctab-btn i' above)
       instead of sharing the avatar's circular ring, which had been
       copied onto them by mistake previously. */
    .ctab-icon-ring {
      width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
    }
    .ctab-avatar {
      width: 26px; height: 26px; border-radius: 50%;
      background-size: cover; background-position: center;
      border: 2px solid var(--ion-color-step-250, rgba(0, 0, 0, 0.15)); flex-shrink: 0; transition: border-color 0.2s;
    }
    .ctab-avatar.active { border-color: var(--ion-color-danger, #d32f2f); }
  `]
})
export class TabsPage implements OnInit, OnDestroy {
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
  navigate(tab: { route: string; id: string }, index: number) {
    const cameFromIndex = this.tabs.findIndex(t => this.router.url.includes('/' + t.id));
    this.activeIndex = index;
    if (this.tour.isActive() && this.tour.targetId() === 'tour-tab-' + tab.id) {
      this.tour.onInteraction();
    }
    if (index >= cameFromIndex) {
      this.navCtrl.navigateForward([tab.route]);
    } else {
      this.navCtrl.navigateBack([tab.route]);
    }
  }
}
