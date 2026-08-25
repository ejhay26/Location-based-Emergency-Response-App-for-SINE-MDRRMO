import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonToast, ModalController, ToastController } from '@ionic/angular/standalone';
import { ApiService } from '../../../core/services/api';
import { TourService } from '../../../core/services/tour';
import { BroadcastRefreshService } from '../../../core/services/broadcast-refresh';
import { EchoService } from '../../../core/services/echo.service';
import { WidgetPinService } from '../../../core/services/widget-pin';
import { OfflineQueueService } from '../../../core/services/offline-queue';
import { DialogService } from '../../../core/services/dialog.service';
import { PressFeedbackDirective } from '../../../shared/directives/press-feedback.directive';
import { ImpactFeedbackDirective } from '../../../shared/directives/impact-feedback.directive';
import { ListEnterDirective } from '../../../shared/directives/list-enter.directive';
import { UtcDatePipe, parseServerDate } from '../../../shared/pipes/utc-date.pipe';
import { reportModalEnter, reportModalLeave } from '../../../core/animations/report-modal-transition';
import { ReportPage } from '../report/report.page';
import { ProxyImageDirective } from '../../../shared/directives/proxy-image.directive';
import { FloatingSosCardComponent, FloatingSosStatus } from '../../../shared/components/floating-sos-card/floating-sos-card.component';
import { AnnouncementsModalComponent } from '../../../shared/components/announcements-modal/announcements-modal.component';

/**
 * Fallback polling interval — active only when the Reverb WebSocket is
 * disconnected. 30s matches the decision recorded in the handoff doc
 * (decision 54). When the socket IS connected, the interval is still
 * running as a safety net but the WebSocket push will almost always arrive
 * first, making the poll a silent no-op rather than visible churn.
 */
const FALLBACK_POLL_MS = 30_000;

/**
 * Stage 3a — Home Screen Widget banner. Shown once to accounts that
 * already existed before this feature shipped (new accounts get the
 * account-setup slide instead, and never see this banner — see
 * account-setup.page.ts). Dismissing it (either "Add" or the X) sets this
 * flag permanently; the Settings page item stays available forever as the
 * evergreen way back in, so nothing is lost by dismissing.
 */
const WIDGET_PROMPT_DISMISSED_KEY = 'widget_prompt_dismissed';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrl: './home.page.scss',
  standalone: true,
  imports: [
    CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonToast,
    PressFeedbackDirective, ImpactFeedbackDirective, ListEnterDirective,
    ProxyImageDirective, FloatingSosCardComponent, UtcDatePipe,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  userFirstName = '';
  activeBroadcasts: any[] = [];

  get topAnnouncements(): any[] {
    return this.activeBroadcasts.slice(0, 2);
  }

  showWidgetBanner = false;
  widgetToastOpen = false;
  widgetToastMessage = '';

  /**
   * Stage 5 — Floating SOS Card data. All active (Pending/Dispatched) SOS
   * requests for this citizen, newest-first. Using all active ones, not just
   * the first, because the user can report the same or a different incident
   * while a previous one is still Pending — each gets its own stacked pill.
   * Null until the first poll resolves; empty array means nothing active.
   */
  activeSosReports: FloatingSosStatus[] = [];

  /** True while Reverb WebSocket is connected — used only for dev/debug; not bound in template. */
  private wsConnected = false;

  private fallbackPollSub?: Subscription;
  private pushRefreshSub?: Subscription;
  private echoEmergencySub?: Subscription;
  private echoBroadcastSub?: Subscription;
  private echoConnectedSub?: Subscription;
  private queryParamsSub?: Subscription;

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    public tour: TourService,
    private broadcastRefresh: BroadcastRefreshService,
    private echo: EchoService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private widgetPin: WidgetPinService,
    public offlineQueue: OfflineQueueService,
    private dialog: DialogService,
  ) {}

  async showToast(message: string, color: 'success' | 'danger' | 'warning' | 'medium' = 'medium') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }

  ngOnInit() {
    const userStr = localStorage.getItem('user');
    if (userStr) this.userFirstName = JSON.parse(userStr).first_name || '';

    // Paint instantly from the cache (if this isn't the first time HomePage
    // has been created this session — see BroadcastRefreshService's doc
    // comment) instead of starting from an empty array and visibly popping
    // the cards back in once the fetch resolves.
    if (this.broadcastRefresh.lastBroadcasts) {
      this.activeBroadcasts = this.broadcastRefresh.lastBroadcasts;
    }

    // Initial fetch regardless of socket state.
    this.fetchBroadcasts();
    this.fetchLatestSos();

    // Listen for widget launch deep link (open_report query parameter)
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      if (params['open_report']) {
        const type = params['open_report'] === 'hazard' ? 'hazard' : 'emergency';
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
        setTimeout(() => this.openReport(type), 180);
      }
    });

    // ── Hybrid real-time strategy ─────────────────────────────────────
    // Primary: Reverb WebSocket events trigger immediate re-fetches.
    // Fallback: 30s interval runs continuously as a safety net for when
    // the socket is disconnected (network blip, mobile background, etc.).
    // The fallback is never removed — it just becomes the sole mechanism
    // when the socket is down.

    this.echo.connect();

    // Track connection state (for fallback awareness).
    this.echoConnectedSub = this.echo.onConnected.subscribe(connected => {
      this.wsConnected = connected;
    });

    // When a BroadcastMessageUpdated event arrives via Reverb, trigger
    // an immediate re-fetch — same as the FCM push path already does.
    this.echoBroadcastSub = this.echo.onBroadcastUpdated.subscribe(() => {
      this.fetchBroadcasts();
    });

    // When EmergencyUpdated arrives (dispatched, resolved, etc.), the
    // citizen's own SOS status may have changed — refresh the pill.
    this.echoEmergencySub = this.echo.onEmergencyUpdated.subscribe(() => {
      this.fetchLatestSos();
    });

    this.pushRefreshSub = this.broadcastRefresh.onRefresh.subscribe(() => this.fetchBroadcasts());

    this.widgetPin.isAvailable().then(available => {
      this.showWidgetBanner = available && !localStorage.getItem(WIDGET_PROMPT_DISMISSED_KEY);
    });
  }

  ionViewWillEnter() {
    if (!localStorage.getItem('api_token')) {
      this.stopPolling();
      return;
    }
    this.startPolling();
  }

  ionViewDidLeave() {
    this.stopPolling();
  }

  ngOnDestroy() {
    this.stopPolling();
    this.queryParamsSub?.unsubscribe();
    this.pushRefreshSub?.unsubscribe();
    this.echoEmergencySub?.unsubscribe();
    this.echoBroadcastSub?.unsubscribe();
    this.echoConnectedSub?.unsubscribe();
  }

  private startPolling() {
    this.stopPolling();
    this.fetchBroadcasts();
    this.fetchLatestSos();
    this.fallbackPollSub = interval(FALLBACK_POLL_MS).subscribe(() => {
      if (!localStorage.getItem('api_token')) {
        this.stopPolling();
        return;
      }
      this.fetchBroadcasts();
      this.fetchLatestSos();
    });
  }

  private stopPolling() {
    if (this.fallbackPollSub) {
      this.fallbackPollSub.unsubscribe();
      this.fallbackPollSub = undefined;
    }
  }

  fetchBroadcasts() {
    if (!localStorage.getItem('api_token')) return;
    this.api.getActiveBroadcast().subscribe({
      next: (res: any) => {
        this.activeBroadcasts = Array.isArray(res) ? res : (res?.message ? [res] : []);
        this.broadcastRefresh.lastBroadcasts = this.activeBroadcasts;
      },
      error: () => {}
    });
  }

  /**
   * Stage 5 — Floating SOS Card data source. `getMyEmergencies` is already
   * ordered by request_time desc server-side (see SosController), so the
   * first Pending/Dispatched entry is genuinely the most recent one; a
   * Resolved/Cancelled first entry means nothing currently active, and the
   * card hides itself (see FloatingSosCardComponent.state). Errors are
   * swallowed the same way fetchBroadcasts() does — a failed background
   * refresh should never surface as a user-facing error on Home, and
   * offline handling is already covered separately by NetworkService/
   * OfflineQueueService for the actual submit path.
   */
  fetchLatestSos() {
    if (!localStorage.getItem('api_token')) return;
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      if (!user?.user_id) return;
      this.api.getMyEmergencies(user.user_id).subscribe({
        next: (res: any) => {
          const list: any[] = Array.isArray(res) ? res : [];
          // Keep ALL active reports, newest-first (server already returns desc
          // order). Each one gets its own stacked pill on the Home page.
          this.activeSosReports = list.filter(
            (r: any) => r.status === 'Pending' || r.status === 'Dispatched'
          );
        },
        error: () => {}
      });
    } catch {}
  }

  /** Floating SOS Card tap — routes to History, where the full record (and its Cancel action) already lives. */
  goToSosStatus() {
    this.router.navigate(['/tabs/history']);
  }

  /**
   * Cancel handler for the floating SOS pill's X button.
   * Two cases:
   *   1. Offline-queued item (queueId set, requestId null) — just remove from
   *      IndexedDB, no API call needed since it never reached the server.
   *   2. Server-confirmed Pending report (requestId set) — calls cancelEmergency
   *      with a loading dialog open during the request, same pattern as the
   *      History page's own cancel action.
   */
  async onSosCancel(ev: { requestId: number | null; queueId: string | null }) {
    // Offline-queue item — simpler confirm, no API call needed.
    if (ev.queueId) {
      const confirmed = await this.dialog.confirm({
        title: 'Remove Queued Report',
        message: "This report hasn't reached MDRRMO yet. Remove it from the queue?",
        icon: 'fa-solid fa-circle-xmark',
        iconColor: '#eb445a',
        confirmLabel: 'Remove',
        confirmColor: 'danger',
      });
      if (confirmed) {
        await this.offlineQueue.removeById(ev.queueId);
        this.showToast('Queued report removed.', 'success');
      }
      return;
    }

    // Server-confirmed Pending report — onConfirm keeps the dialog open with
    // a spinner while the API call is in flight, then closes on success.
    await this.dialog.confirm({
      title: 'Cancel SOS Report',
      message: 'Are you sure you want to cancel this emergency report? Only do this if the situation has been resolved or was reported by mistake.',
      icon: 'fa-solid fa-triangle-exclamation',
      iconColor: '#eb445a',
      confirmLabel: 'Yes, Cancel Report',
      confirmColor: 'danger',
      onConfirm: async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        await new Promise<void>((resolve, reject) => {
          this.api.cancelEmergency({ request_id: ev.requestId, user_id: user.user_id }).subscribe({
            next: () => {
              this.showToast('SOS report cancelled.', 'success');
              resolve();
            },
            error: (e) => reject(e),
          });
        });
        // Refresh pill list immediately so it disappears without waiting
        // for the next 30s fallback poll.
        this.fetchLatestSos();
      },
    });
  }

  /** Queued-offline SOS items only — reads the shared reactive signal so no separate IndexedDB call is needed here. */
  get queuedSosItems() {
    return this.offlineQueue.items().filter(i => i.kind === 'sos');
  }

  /**
   * Without this, every poll re-assigns `activeBroadcasts` to a brand new
   * array of freshly-parsed JSON objects — different references even when
   * the underlying data hasn't changed. Angular's default *ngFor diffs by
   * object identity, so with no trackBy it would read that as "every item
   * removed, every item re-added", destroy and recreate every card, and (as
   * a direct side effect) re-trigger appAnnouncementEnter's ngOnInit on all
   * of them. Tracking by the real DB primary key instead lets Angular
   * recognize "same broadcast, new object" and just patch the existing DOM
   * node's bindings in place — no destroy, no replay.
   */
  trackByBroadcastId(_index: number, b: any): number {
    return b.broadcast_id;
  }

  timeAgo(dateStr: string): string {
    const date = parseServerDate(dateStr);
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  /** X button — a real decision to skip, not just backing out of the confirm dialog, so this permanently hides the banner and points them to Settings. */
  dismissWidgetBanner() {
    localStorage.setItem(WIDGET_PROMPT_DISMISSED_KEY, '1');
    this.showWidgetBanner = false;
    this.widgetToastMessage = 'No problem — you can add it anytime from Settings > Home Screen Widget.';
    this.widgetToastOpen = true;
  }

  async addWidgetFromBanner() {
    const confirmed = await this.dialog.confirm({
      title: 'Add Report Widget to Home Screen',
      message: 'In an emergency, every second counts. This puts a "Report Emergency" button right on your home screen, so you can start a report the moment something happens — no unlocking through the app, no digging for the right screen. Tap Add, then confirm the placement prompt Android shows you.',
      icon: 'apps-outline',
      iconColor: 'primary',
      confirmLabel: 'Add Widget',
      confirmColor: 'primary',
    });
    // Cancelling the confirm dialog is just backing out, not a decision to
    // skip — leave the banner up so they can revisit it this session.
    if (!confirmed) return;

    const requested = await this.widgetPin.requestPin();
    localStorage.setItem(WIDGET_PROMPT_DISMISSED_KEY, '1');
    this.showWidgetBanner = false;
    this.widgetToastMessage = requested
      ? 'Confirm in the prompt that just appeared to finish adding the widget.'
      : "Couldn't open the widget prompt on this device. You can try again anytime from Settings.";
    this.widgetToastOpen = true;
  }

  /**
   * Report is presented as a custom-styled ion-modal (see .report-modal in
   * global.scss + report-modal-transition.ts) rather than a routed page.
   * This is what actually keeps HomePage's own component instance alive
   * underneath instead of being destroyed/recreated on the way there and
   * back — the broadcast cache alone only masked the symptom (a data
   * flash), not the cause (entrance animations replaying every return
   * trip). Deliberately NOT using Ionic's default modal presentation
   * (`presentingElement`, the iOS card-shrink effect, the sheet handle) —
   * fully custom instead, per explicit direction to avoid Ionic's default
   * modal look entirely.
   */
  private async openReport(type: 'emergency' | 'hazard') {
    this.tour.onInteraction();
    if (this.tour.isActive()) return;
    const modal = await this.modalCtrl.create({
      component: ReportPage,
      componentProps: { reportType: type, presentedAsModal: true },
      cssClass: 'report-modal',
      backdropDismiss: false,
      enterAnimation: reportModalEnter,
      leaveAnimation: reportModalLeave,
    });
    await modal.present();
  }

  goToSos() { this.openReport('emergency'); }

  goToHazard() { this.openReport('hazard'); }

  async openAllAnnouncements() {
    const modal = await this.modalCtrl.create({
      component: AnnouncementsModalComponent,
      componentProps: { broadcasts: this.activeBroadcasts }
    });
    await modal.present();
  }

  openMedia(path: string, isVideo = false, allMedia?: string[]) {
    if (allMedia && Array.isArray(allMedia) && allMedia.length > 0) {
      const items = allMedia.map(m => ({
        url: this.getMediaUrl(m),
        isVideo: this.isVideoFile(m)
      }));
      const idx = allMedia.indexOf(path);
      this.dialog.openLightbox(items, Math.max(0, idx));
      return;
    }
    const url = this.getMediaUrl(path);
    this.dialog.openLightbox(url, isVideo);
  }

  isVideoFile(path: string): boolean {
    return path?.toLowerCase().endsWith('.mp4') || path?.toLowerCase().endsWith('.webm');
  }

  getMediaUrl(path: string): string {
    return this.api.resolveFileUrl(path);
  }
}
