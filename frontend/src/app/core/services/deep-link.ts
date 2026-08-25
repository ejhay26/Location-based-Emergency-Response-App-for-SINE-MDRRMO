import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { ModalController } from '@ionic/angular/standalone';
import { reportModalEnter, reportModalLeave } from '../animations/report-modal-transition';
import { ReportPage } from '../../features/citizen/report/report.page';

/**
 * Custom URL scheme used for all in-app deep links (Home Screen Widgets,
 * and any future external launch source). Must stay in sync with:
 *  - android/app/src/main/AndroidManifest.xml (MainActivity intent-filter)
 *  - ios/App/App/Info.plist (CFBundleURLTypes)
 */
const DEEP_LINK_SCHEME = 'sinemdrrmo';
const PENDING_KEY = 'pending_deep_link';

@Injectable({ providedIn: 'root' })
export class DeepLinkService {

  constructor(
    private router: Router,
    private modalCtrl: ModalController,
  ) {}

  /** Call once, from AppComponent.ngOnInit(). No-op on web/Electron. */
  init(): void {
    if (!Capacitor.isNativePlatform()) return;

    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.handleUrl(event.url);
    });
  }

  handleUrl(rawUrl: string): void {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      console.warn('DeepLinkService: unparseable URL', rawUrl);
      return;
    }

    if (url.protocol !== `${DEEP_LINK_SCHEME}:`) return; // not ours — ignore

    const host = url.hostname;
    if (host !== 'report') {
      console.warn('DeepLinkService: unknown deep-link host', host);
      return;
    }

    const type = url.searchParams.get('type') === 'hazard' ? 'hazard' : 'emergency';
    this.openReportOrDefer(type);
  }

  private async openReportOrDefer(type: 'emergency' | 'hazard'): Promise<void> {
    const user = localStorage.getItem('user');
    const role = localStorage.getItem('role');

    if (user && role === 'citizen') {
      // Ensure we are on the citizen home screen
      if (!this.router.url.includes('/tabs/')) {
        await this.router.navigateByUrl('/tabs/home');
      }

      // Dismiss any open modal before presenting a fresh report modal
      const topModal = await this.modalCtrl.getTop();
      if (topModal) {
        await topModal.dismiss();
      }

      setTimeout(async () => {
        const modal = await this.modalCtrl.create({
          component: ReportPage,
          componentProps: { reportType: type, presentedAsModal: true },
          cssClass: 'report-modal',
          backdropDismiss: false,
          enterAnimation: reportModalEnter,
          leaveAnimation: reportModalLeave,
        });
        await modal.present();
      }, 80);
      return;
    }

    // Not logged in (or logged in as admin/dispatcher): stash it and send to login
    sessionStorage.setItem(PENDING_KEY, type);
    this.router.navigate(['/login']);
  }

  /**
   * Called by LoginPage right after a successful citizen login.
   * If a report deep link was pending, opens it as a modal on the home screen.
   */
  consumePendingDeepLink(): string | null {
    const pendingType = sessionStorage.getItem(PENDING_KEY);
    if (pendingType) {
      sessionStorage.removeItem(PENDING_KEY);
      setTimeout(() => {
        this.openReportOrDefer(pendingType === 'hazard' ? 'hazard' : 'emergency');
      }, 300);
    }
    return null;
  }
}
